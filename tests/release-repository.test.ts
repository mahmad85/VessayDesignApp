import { describe, it, expect } from 'vitest';
import {
  bootstrapCatalog,
  ensureCatalog,
  getCurrentVersion,
  getRelease,
  publish,
  restoreToWorkingCopy,
} from '../src/db/release-repository';
import { importLegacyCatalog } from '../src/modules/catalog/import-legacy';
import { snapshotChecksum } from '../src/modules/catalog/snapshot-checksum';
import { PGLITE_TIMEOUT, setupTestDatabase } from './helpers/db';

// CATALOG-ADMIN.md §7.3–7.5, ADMIN-BACKEND.md §6, TASK-015 steps 7–9. The
// catalog is the user-supplied reference seed; the edits made here are
// SYNTHETIC test changes to the working copy.

const database = setupTestDatabase();
const legacyChecksum = snapshotChecksum(importLegacyCatalog().snapshot);
const peakLabel = (label: string) =>
  database().then((db) =>
    db.query(
      "UPDATE option_values SET label=$1 WHERE code='peak' AND attribute_id=(SELECT id FROM attributes WHERE code='style.jacket.jacket_lapel_type_combinated.jacket-lapel-type')",
      [label],
    ),
  );
const count = async (sql: string, params: unknown[] = []) => {
  const db = await database();
  const [row] = await db.query<{ n: number }>(sql, params);
  return row.n;
};
/** Publishes with the current warnings acknowledged, as the admin screen does after review. */
async function publishAcknowledged(expectedCurrentVersion: number, notes = 'SYNTHETIC change') {
  const first = await publish('user:synthetic-admin', {
    actionId: crypto.randomUUID(),
    expectedCurrentVersion,
    notes,
    acknowledgeWarnings: false,
  }).catch((e) => e);
  expect(first.code).toBe('warnings_unacknowledged');
  return publish('user:synthetic-admin', {
    actionId: crypto.randomUUID(),
    expectedCurrentVersion,
    notes,
    acknowledgeWarnings: true,
    warningsChecksum: first.details.report.warningsChecksum,
  });
}

describe('catalog releases', { timeout: PGLITE_TIMEOUT }, () => {
  it('bootstrap imports the reference data and publishes a reference-only v1', async () => {
    expect(await getCurrentVersion()).toBeNull();
    expect(await bootstrapCatalog()).toEqual({ version: 1, created: true });
    const db = await database();
    const [release] = await db.query<{
      validation: { errors: unknown[]; warnings: unknown[]; warningsAcknowledgedBy: string };
    }>(
      'SELECT version,checksum,reference_only,published_by,notes,validation,restored_from_version FROM catalog_releases',
    );
    expect(release).toMatchObject({
      version: 1,
      checksum: legacyChecksum,
      reference_only: true,
      published_by: 'system:bootstrap',
      restored_from_version: null,
    });
    expect(release.validation.errors).toEqual([]);
    expect(release.validation.warnings.length).toBeGreaterThan(0);
    expect(release.validation.warningsAcknowledgedBy).toBe('system:bootstrap');
    expect(
      await count('SELECT count(*)::int AS n FROM products WHERE first_published_version=1'),
    ).toBe(3);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM option_values WHERE status='active' AND first_published_version IS NULL",
      ),
    ).toBe(0);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM lookup_types WHERE system AND code IN ('occasion','tag')",
      ),
    ).toBe(2);
    expect(
      (
        await db.query(
          "SELECT action FROM audit_events WHERE actor='system:bootstrap' ORDER BY created_at",
        )
      ).map((row) => row.action),
    ).toEqual(['catalog.working_copy_loaded', 'catalog.published']);
  });

  it('re-running the bootstrap, or ensureCatalog, changes nothing', async () => {
    const audits = await count('SELECT count(*)::int AS n FROM audit_events');
    expect(await bootstrapCatalog()).toEqual({ version: 1, created: false });
    expect(await ensureCatalog()).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM catalog_releases')).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM audit_events')).toBe(audits);
  });

  it('serves a release parsed once, with its customer projection and index', async () => {
    const release = (await getRelease(1))!;
    expect(release.snapshot).toMatchObject({ version: 1, referenceOnly: true });
    expect(release.snapshot.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(release.checksum).toBe(legacyChecksum);
    expect(snapshotChecksum(release.snapshot)).toBe(legacyChecksum);
    expect(release.index.products.get('suit')?.name).toBe('Two-piece suit');
    expect(release.customer.materials.every((material) => material.supplier === null)).toBe(true);
    expect(await getRelease(1)).toBe(release);
    expect(await getRelease(99)).toBeNull();
  });

  it('rejects a publish with nothing to publish', async () => {
    await expect(
      publish('user:synthetic-admin', {
        actionId: crypto.randomUUID(),
        expectedCurrentVersion: 1,
        acknowledgeWarnings: true,
      }),
    ).rejects.toMatchObject({ code: 'nothing_to_publish', status: 422 });
  });

  it('blocks publishing on validation errors and reports them', async () => {
    const db = await database();
    await db.query(
      "UPDATE option_groups SET focus_region='nowhere' WHERE code='style.jacket.jacket_vent'",
    );
    const blocked = await publish('user:synthetic-admin', {
      actionId: crypto.randomUUID(),
      expectedCurrentVersion: 1,
      acknowledgeWarnings: true,
    }).catch((e) => e);
    expect(blocked).toMatchObject({ code: 'publish_blocked', status: 422 });
    expect(blocked.details.report.errors).toEqual([
      expect.objectContaining({
        code: 'focus_region_unknown',
        entityCode: 'style.jacket.jacket_vent',
      }),
    ]);
    await db.query(
      "UPDATE option_groups SET focus_region='vent' WHERE code='style.jacket.jacket_vent'",
    );
  });

  it('requires the current warnings to be acknowledged, then publishes v2', async () => {
    await peakLabel('Peak (SYNTHETIC)');
    const stale = await publish('user:synthetic-admin', {
      actionId: crypto.randomUUID(),
      expectedCurrentVersion: 1,
      acknowledgeWarnings: true,
      warningsChecksum: 'outdated',
    }).catch((e) => e);
    expect(stale).toMatchObject({ code: 'warnings_unacknowledged', status: 409 });
    const result = await publishAcknowledged(1);
    expect(result).toMatchObject({ version: 2, referenceOnly: true });
    expect(result.checksum).not.toBe(legacyChecksum);
    const v2 = (await getRelease(2))!;
    const peak = v2.index.values.get(
      'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type::peak',
    );
    expect(peak?.value.label).toBe('Peak (SYNTHETIC)');
    // v1 is unchanged (AC-19: history is preserved).
    const v1 = (await getRelease(1))!;
    expect(
      v1.index.values.get('style.jacket.jacket_lapel_type_combinated.jacket-lapel-type::peak')
        ?.value.label,
    ).toBe('Peak');
  });

  it('lets only one of two concurrent publishes win; the other gets stale_release', async () => {
    await peakLabel('Peak (SYNTHETIC 2)');
    const warning = await publish('user:synthetic-admin', {
      actionId: crypto.randomUUID(),
      expectedCurrentVersion: 2,
      acknowledgeWarnings: false,
    }).catch((e) => e);
    const checksum = warning.details.report.warningsChecksum;
    const attempt = () =>
      publish('user:synthetic-admin', {
        actionId: crypto.randomUUID(),
        expectedCurrentVersion: 2,
        acknowledgeWarnings: true,
        warningsChecksum: checksum,
      });
    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({
      code: 'stale_release',
      status: 409,
      details: { currentVersion: 3 },
    });
    expect((await getCurrentVersion())?.version).toBe(3);
  });

  it('replays a publish by action id and refuses a reused id with different input', async () => {
    await peakLabel('Peak (SYNTHETIC 3)');
    const warning = await publish('user:synthetic-admin', {
      actionId: crypto.randomUUID(),
      expectedCurrentVersion: 3,
      acknowledgeWarnings: false,
    }).catch((e) => e);
    const input = {
      actionId: crypto.randomUUID(),
      expectedCurrentVersion: 3,
      notes: 'SYNTHETIC replay',
      acknowledgeWarnings: true,
      warningsChecksum: warning.details.report.warningsChecksum,
    };
    const first = await publish('user:synthetic-admin', input);
    expect(await publish('user:synthetic-admin', input)).toEqual(first);
    await expect(
      publish('user:synthetic-admin', { ...input, notes: 'different' }),
    ).rejects.toMatchObject({
      code: 'action_conflict',
    });
    expect((await getCurrentVersion())?.version).toBe(4);
  });

  it('restores v1 into the working copy; publishing gives a new version with v1’s checksum', async () => {
    const summary = await restoreToWorkingCopy('user:synthetic-admin', 1);
    expect(summary.updated).toBeGreaterThan(0);
    const result = await publishAcknowledged(4, 'SYNTHETIC rollback to v1');
    expect(result).toMatchObject({ version: 5, checksum: legacyChecksum });
    const db = await database();
    const [row] = await db.query(
      'SELECT restored_from_version FROM catalog_releases WHERE version=5',
    );
    expect(row.restored_from_version).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM catalog_releases')).toBe(5);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM audit_events WHERE action='catalog.restored' AND entity_id='1'",
      ),
    ).toBe(1);
    await expect(restoreToWorkingCopy('user:synthetic-admin', 42)).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});
