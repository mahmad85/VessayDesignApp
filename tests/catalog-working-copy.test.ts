import { describe, it, expect } from 'vitest';
import { importLegacyCatalog } from '../src/modules/catalog/import-legacy';
import { compileWorkingCopy, inactiveLookups } from '../src/modules/catalog/compile';
import { parseSnapshot, indexSnapshot } from '../src/modules/catalog/snapshot';
import { defaultsFor } from '../src/modules/catalog/structure';
import { snapshotChecksum } from '../src/modules/catalog/snapshot-checksum';
import {
  loadSnapshotIntoWorkingCopy,
  loadWorkingRows,
  seedLookupTypes,
} from '../src/db/catalog-admin-repository';
import { PGLITE_TIMEOUT, setupTestDatabase } from './helpers/db';
import { SYN, syntheticSnapshot } from './fixtures/catalog.synthetic';

// CATALOG-ADMIN.md §7.1–7.2, §7.5. The legacy import is the user-supplied
// reference seed; everything else here is SYNTHETIC.

const database = setupTestDatabase();
const legacy = importLegacyCatalog();
const actor = 'system:bootstrap';
const compile = async () => {
  const db = await database();
  return compileWorkingCopy(await loadWorkingRows(db.query));
};
const versions = async () => {
  const db = await database();
  const tables = [
    'components',
    'option_groups',
    'attributes',
    'option_values',
    'products',
    'materials',
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const [row] = await db.query<{ total: number }>(
      `SELECT coalesce(sum(row_version),0)::int AS total FROM ${table}`,
    );
    counts[table] = row.total;
  }
  return counts;
};
/** Synthetic media paths do not exist on disk; tests supply their bytes. */
const readStatic = async (url: string) => new TextEncoder().encode(`SYNTHETIC ${url}`);

describe('working copy ⇄ snapshot', { timeout: PGLITE_TIMEOUT }, () => {
  it('round-trips the legacy import: import → load → compile gives the same checksum', async () => {
    const db = await database();
    const summary = await db.transaction(async (query) => {
      await seedLookupTypes(query, legacy.lookupTypes);
      return loadSnapshotIntoWorkingCopy(query, legacy.snapshot, actor);
    });
    expect(summary.changed).toBe(true);
    expect(summary.byTable.option_values.created).toBe(436);
    expect(summary.byTable.media_assets.created).toBe(Object.keys(legacy.snapshot.media).length);
    const compiled = await compile();
    expect(compiled).toEqual(legacy.snapshot);
    expect(snapshotChecksum(parseSnapshot(compiled))).toBe(snapshotChecksum(legacy.snapshot));
    const [audit] = await db.query(
      "SELECT actor,summary FROM audit_events WHERE action='catalog.working_copy_loaded'",
    );
    expect(audit).toMatchObject({ actor, summary: { after: { created: summary.created } } });
    const [media] = await db.query<{ bytes: number; sha256: string }>(
      "SELECT bytes,sha256 FROM media_assets WHERE storage_key='/reference-assets/fabrics/navy-twill.svg'",
    );
    expect(media.bytes).toBeGreaterThan(0);
    expect(media.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is a no-op when the same snapshot is loaded again', async () => {
    const db = await database();
    const before = await versions();
    const [{ n: audits }] = await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM audit_events',
    );
    const summary = await db.transaction((query) =>
      loadSnapshotIntoWorkingCopy(query, legacy.snapshot, actor),
    );
    expect(summary).toMatchObject({
      changed: false,
      created: 0,
      updated: 0,
      archived: 0,
      deleted: 0,
    });
    expect(await versions()).toEqual(before);
    const [{ n }] = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM audit_events');
    expect(n).toBe(audits);
  });

  it('excludes draft and archived rows from the compile', async () => {
    const db = await database();
    const [jacket] = await db.query<{ id: string }>(
      "SELECT id FROM components WHERE code='jacket'",
    );
    await db.query(
      "INSERT INTO option_groups(id,code,component_id,name,short_name,kind,status,focus_region) VALUES('g-draft','style.jacket.syn_draft',$1,'SYNTHETIC draft','Draft','style','draft','torso')",
      [jacket.id],
    );
    await db.query(
      "INSERT INTO products(id,code,name,short_label,measurement_set,visual_model,status) VALUES('p-draft','syn-draft','SYNTHETIC','S','suit','suit','draft')",
    );
    await db.query(
      "INSERT INTO materials(id,code,name,status,primary_hex) VALUES('m-archived','syn-archived','SYNTHETIC','archived','#112233')",
    );
    const staged = await compile();
    expect(snapshotChecksum(staged)).toBe(snapshotChecksum(legacy.snapshot));
    await db.query(
      "UPDATE option_values SET status='archived' WHERE code='peak' AND attribute_id=(SELECT id FROM attributes WHERE code='style.jacket.jacket_lapel_type_combinated.jacket-lapel-type')",
    );
    const archived = await compile();
    expect(snapshotChecksum(archived)).not.toBe(snapshotChecksum(legacy.snapshot));
    const lapel = archived.components
      .find((component) => component.code === 'jacket')!
      .groups.find((group) => group.code === 'style.jacket.jacket_lapel_type_combinated')!
      .attributes.find((attribute) => attribute.code.endsWith('jacket-lapel-type'))!;
    expect(lapel.values.map((value) => value.code)).toEqual(['standard', 'round']);
    // Loading the release again restores the choice and archives the staged draft.
    await db.transaction((query) => loadSnapshotIntoWorkingCopy(query, legacy.snapshot, actor));
    expect(snapshotChecksum(await compile())).toBe(snapshotChecksum(legacy.snapshot));
    const [draft] = await db.query("SELECT status FROM option_groups WHERE id='g-draft'");
    expect(draft.status).toBe('archived');
  });

  it('never overwrites live material availability', async () => {
    const db = await database();
    await db.query(
      "UPDATE materials SET availability='low_stock',lead_time_days=12,stock_meters=14.5 WHERE code='navy-twill'",
    );
    await db.transaction((query) => loadSnapshotIntoWorkingCopy(query, legacy.snapshot, actor));
    const [row] = await db.query(
      "SELECT availability,lead_time_days,stock_meters FROM materials WHERE code='navy-twill'",
    );
    expect(row).toMatchObject({ availability: 'low_stock', lead_time_days: 12 });
    expect(Number(row.stock_meters)).toBe(14.5);
  });

  it('replaces the working copy with another snapshot and round-trips every entity type', async () => {
    const db = await database();
    await db.query(
      "INSERT INTO suppliers(id,code,name,kind) VALUES('syn-supplier-1','syn-mill','SYNTHETIC Mill','fabric_mill')",
    );
    const synthetic = syntheticSnapshot({ navyOverrideForSuit: 129900 });
    const summary = await db.transaction((query) =>
      loadSnapshotIntoWorkingCopy(query, synthetic, 'system:test', { readStatic }),
    );
    expect(summary.archived).toBeGreaterThan(400);
    const compiled = await compile();
    // WP-33/34: compilation resolves look defaults and prices without editing the stored look.
    const expected = structuredClone(synthetic);
    const index = indexSnapshot(synthetic);
    expected.templates[0].selections = {
      ...defaultsFor(index, index.products.get('suit')!),
      ...synthetic.templates[0].selections,
    };
    expected.templates[0].asShownPriceMinor = 139900;
    expect(compiled).toEqual(expected);
    expect(snapshotChecksum(compiled)).toBe(snapshotChecksum(expected));
    const [storedLook] = await db.query('SELECT selections FROM templates WHERE code=$1', [
      synthetic.templates[0].code,
    ]);
    expect(storedLook.selections).toEqual(synthetic.templates[0].selections);
    // Imported rows missing from this snapshot are archived, not deleted.
    const [fit] = await db.query(
      "SELECT status FROM option_groups WHERE code='style.jacket.jacket_fit'",
    );
    expect(fit.status).toBe('archived');
    const [shared] = await db.query("SELECT status FROM components WHERE code='jacket'");
    expect(shared.status).toBe('active');
    // Existing ids are kept by code.
    const [suit] = await db.query<{ id: string }>("SELECT id FROM products WHERE code='suit'");
    const again = await db.transaction((query) =>
      loadSnapshotIntoWorkingCopy(query, synthetic, 'system:test', { readStatic }),
    );
    expect(again.changed).toBe(false);
    const [same] = await db.query<{ id: string }>("SELECT id FROM products WHERE code='suit'");
    expect(same.id).toBe(suit.id);
    // Lookups that the snapshot does not hold are deactivated, and reported as such.
    const inactive = inactiveLookups(await loadWorkingRows(db.query));
    expect(inactive.care).toContain('dry_clean_only');
    expect(inactive.pattern).not.toContain('twill');
  });

  it('restores the legacy import over the synthetic snapshot with the original checksum', async () => {
    const db = await database();
    await db.transaction((query) => loadSnapshotIntoWorkingCopy(query, legacy.snapshot, actor));
    const compiled = await compile();
    expect(snapshotChecksum(compiled)).toBe(snapshotChecksum(legacy.snapshot));
    const [override] = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM material_price_overrides o JOIN materials m ON m.id=o.material_id WHERE m.status='active'",
    );
    expect(override.n).toBe(0);
    const [rule] = await db.query(
      "SELECT status FROM compatibility_rules WHERE code='syn-no-peak-on-linen'",
    );
    expect(rule.status).toBe('archived');
    const [template] = await db.query('SELECT status FROM templates WHERE code=$1', [SYN.template]);
    expect(template.status).toBe('archived');
  });
});
