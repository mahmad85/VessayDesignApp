import { z } from 'zod';
import { canonicalJson, sha256Hex } from '@/lib/canonical-json';
import { DomainError } from '@/modules/configuration/types';
import { compileWorkingCopy, inactiveLookups } from '@/modules/catalog/compile';
import { importLegacyCatalog } from '@/modules/catalog/import-legacy';
import { toCustomerCatalog } from '@/modules/catalog/projection';
import {
  indexSnapshot,
  parseSnapshot,
  type CatalogIndex,
  type CatalogSnapshot,
  type CustomerCatalog,
} from '@/modules/catalog/snapshot';
import { snapshotChecksum } from '@/modules/catalog/snapshot-checksum';
import { validateRelease, type ValidationReport } from '@/modules/catalog/validate-release';
import { writeAudit } from './audit';
import {
  loadSnapshotIntoWorkingCopy,
  loadWorkingRows,
  seedLookupTypes,
  type LoadSummary,
} from './catalog-admin-repository';
import { getDatabase, type Query } from './client';

// Immutable, versioned catalog releases (CATALOG-ADMIN.md §7.3, §7.5;
// ADMIN-BACKEND.md §6). Publishing is one transaction under an advisory lock;
// releases are never rewritten. Customers only ever read releases.

/** Publish and restore serialise on this lock (the migration lock is 731850). */
export const PUBLISH_LOCK = 731851;
const BOOTSTRAP_ACTOR = 'system:bootstrap';

export const publishInput = z
  .object({
    actionId: z.uuid(),
    expectedCurrentVersion: z.number().int().positive().nullable(),
    notes: z.string().max(500).default(''),
    acknowledgeWarnings: z.boolean(),
    warningsChecksum: z.string().max(128).optional(),
  })
  .strict();
export type PublishInput = z.input<typeof publishInput>;
export type PublishResult = {
  version: number;
  publishedAt: string;
  referenceOnly: boolean;
  checksum: string;
};

export function catalogAutoBootstrap() {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.CATALOG_AUTO_BOOTSTRAP !== 'false';
}

type CurrentRelease = { version: number; checksum: string; referenceOnly: boolean };
async function currentIn(query: Query): Promise<CurrentRelease | null> {
  const [row] = await query<{ version: number; checksum: string; reference_only: boolean }>(
    'SELECT version,checksum,reference_only FROM catalog_releases ORDER BY version DESC LIMIT 1',
  );
  return row
    ? { version: row.version, checksum: row.checksum, referenceOnly: row.reference_only }
    : null;
}

/** The current (highest) release, read on each request that needs the catalog. */
export async function getCurrentVersion(): Promise<CurrentRelease | null> {
  return currentIn((await getDatabase()).query);
}

export type LoadedRelease = {
  version: number;
  checksum: string;
  snapshot: CatalogSnapshot;
  customer: CustomerCatalog;
  index: CatalogIndex;
};
const cache = globalThis as unknown as {
  vessyReleases?: Map<number, Promise<LoadedRelease | null>>;
};
const RELEASE_CACHE_SIZE = 5;

/** A release, parsed and validated once per process (LRU of 5; releases are immutable). */
export async function getRelease(version: number): Promise<LoadedRelease | null> {
  const releases = (cache.vessyReleases ??= new Map());
  const hit = releases.get(version);
  if (hit) {
    releases.delete(version);
    releases.set(version, hit);
    return hit;
  }
  const loading = (async () => {
    const db = await getDatabase();
    const [row] = await db.query<{ snapshot: unknown; checksum: string }>(
      'SELECT snapshot,checksum FROM catalog_releases WHERE version=$1',
      [version],
    );
    if (!row) return null;
    const snapshot = parseSnapshot(row.snapshot);
    return {
      version,
      checksum: row.checksum,
      snapshot,
      customer: toCustomerCatalog(snapshot),
      index: indexSnapshot(snapshot),
    };
  })();
  releases.set(version, loading);
  loading.then(
    (release) => {
      if (!release) releases.delete(version);
    },
    () => releases.delete(version),
  );
  while (releases.size > RELEASE_CACHE_SIZE) releases.delete(releases.keys().next().value!);
  return loading;
}

const serialised = new WeakMap<LoadedRelease, string>();
/** The customer projection of a release as JSON text, serialised once per loaded release. */
export async function customerCatalogJson(version: number): Promise<string | null> {
  const release = await getRelease(version);
  if (!release) return null;
  let text = serialised.get(release);
  if (text === undefined) {
    text = JSON.stringify(release.customer);
    serialised.set(release, text);
  }
  return text;
}

const fingerprint = (input: z.output<typeof publishInput>) =>
  sha256Hex(
    canonicalJson({
      expectedCurrentVersion: input.expectedCurrentVersion,
      notes: input.notes,
      acknowledgeWarnings: input.acknowledgeWarnings,
      warningsChecksum: input.warningsChecksum ?? null,
    }),
  );

const CATALOG_TABLES = [
  'products',
  'components',
  'option_groups',
  'attributes',
  'option_values',
  'materials',
  'compatibility_rules',
  'templates',
];

/** Publish inside a transaction that already holds PUBLISH_LOCK. */
async function publishLocked(
  query: Query,
  actor: string,
  raw: PublishInput,
  system = false,
): Promise<PublishResult> {
  const input = publishInput.parse(raw);
  const print = fingerprint(input);
  const [replay] = await query<{
    version: number;
    checksum: string;
    reference_only: boolean;
    published_at: Date | string;
    print: string | null;
  }>(
    "SELECT version,checksum,reference_only,published_at,validation->>'actionFingerprint' AS print FROM catalog_releases WHERE validation->>'actionId'=$1",
    [input.actionId],
  );
  if (replay) {
    if (replay.print !== print)
      throw new DomainError('action_conflict', 'This action identifier was already used.', 409);
    return {
      version: replay.version,
      publishedAt: new Date(replay.published_at).toISOString(),
      referenceOnly: replay.reference_only,
      checksum: replay.checksum,
    };
  }

  const current = await currentIn(query);
  if ((current?.version ?? null) !== input.expectedCurrentVersion)
    throw new DomainError(
      'stale_release',
      'Someone else published the catalog in the meantime. Review the changes and publish again.',
      409,
      { currentVersion: current?.version ?? null },
    );

  const rows = await loadWorkingRows(query);
  const compiled = compileWorkingCopy(rows);
  const report: ValidationReport = validateRelease(compiled, {
    inactiveLookups: inactiveLookups(rows),
  });
  if (report.errors.length)
    throw new DomainError(
      'publish_blocked',
      'The catalog has problems to fix before it can be published.',
      422,
      { report },
    );
  const checksum = snapshotChecksum(compiled);
  if (current && checksum === current.checksum)
    throw new DomainError('nothing_to_publish', 'There are no unpublished changes.', 422, {
      currentVersion: current.version,
    });
  if (
    report.warnings.length &&
    !system &&
    (!input.acknowledgeWarnings || input.warningsChecksum !== report.warningsChecksum)
  )
    throw new DomainError(
      'warnings_unacknowledged',
      'Review and acknowledge the current warnings before publishing.',
      409,
      { report },
    );

  let snapshot: CatalogSnapshot;
  try {
    snapshot = parseSnapshot(compiled);
  } catch (e) {
    if (e instanceof z.ZodError)
      throw new DomainError(
        'publish_blocked',
        'The catalog does not match the release contract.',
        422,
        {
          fields: e.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        },
      );
    throw e;
  }
  const version = (current?.version ?? 0) + 1;
  const publishedAt = new Date().toISOString();
  // TPL-004: look prices are set here from the same release once pricing exists (WP-34).
  const stamped: CatalogSnapshot = { ...snapshot, version, publishedAt };
  const [restored] = await query<{ version: number }>(
    'SELECT version FROM catalog_releases WHERE checksum=$1 ORDER BY version DESC LIMIT 1',
    [checksum],
  );
  await query(
    'INSERT INTO catalog_releases(version,id,snapshot,checksum,reference_only,notes,validation,restored_from_version,published_by,published_at) VALUES($1,$2,$3::jsonb,$4,$5,$6,$7::jsonb,$8,$9,$10)',
    [
      version,
      crypto.randomUUID(),
      JSON.stringify(stamped),
      checksum,
      stamped.referenceOnly,
      input.notes,
      JSON.stringify({
        errors: [],
        warnings: report.warnings,
        warningsChecksum: report.warningsChecksum,
        warningsAcknowledgedBy: report.warnings.length ? actor : null,
        actionId: input.actionId,
        actionFingerprint: print,
      }),
      restored?.version ?? null,
      actor,
      publishedAt,
    ],
  );
  // First publication makes codes immutable (CATALOG-ADMIN §7.2). Not an edit: row versions stay.
  for (const table of CATALOG_TABLES)
    await query(
      `UPDATE ${table} SET first_published_version=$1 WHERE first_published_version IS NULL AND status='active'`,
      [version],
    );
  await query(
    'UPDATE lookup_values SET first_published_version=$1 WHERE first_published_version IS NULL AND active',
    [version],
  );
  await query(
    'UPDATE price_bands SET first_published_version=$1 WHERE first_published_version IS NULL AND code = ANY($2::text[])',
    [version, stamped.priceBands.map((band) => band.code)],
  );
  await writeAudit(query, {
    actor,
    action: 'catalog.published',
    entityType: 'catalog_release',
    entityId: String(version),
    summary: {
      fields: ['version'],
      after: {
        version,
        checksum,
        referenceOnly: stamped.referenceOnly,
        warnings: report.warnings.length,
        restoredFromVersion: restored?.version ?? null,
      },
    },
  });
  return { version, publishedAt, referenceOnly: stamped.referenceOnly, checksum };
}

/**
 * Publish the working copy as the next release (CATALOG-ADMIN §7.3): compile,
 * validate, require acknowledged warnings, insert, stamp first publication and
 * audit, all in one transaction under PUBLISH_LOCK. Idempotent by `actionId`.
 */
export async function publish(actor: string, input: PublishInput): Promise<PublishResult> {
  const db = await getDatabase();
  return db.transaction(async (query) => {
    await query('SELECT pg_advisory_xact_lock($1)', [PUBLISH_LOCK]);
    return publishLocked(query, actor, input);
  });
}

/**
 * Import today's catalog and publish it as v1 when no release exists
 * (CATALOG-ADMIN §10). System lookup types are always seeded (insert-only);
 * the working copy is never reloaded once a release exists.
 */
export async function bootstrapCatalog(actor = BOOTSTRAP_ACTOR) {
  const db = await getDatabase();
  return db.transaction(async (query) => {
    await query('SELECT pg_advisory_xact_lock($1)', [PUBLISH_LOCK]);
    const { snapshot, lookupTypes } = importLegacyCatalog();
    await seedLookupTypes(query, lookupTypes);
    const current = await currentIn(query);
    if (current) return { version: current.version, created: false };
    await loadSnapshotIntoWorkingCopy(query, snapshot, actor);
    const result = await publishLocked(
      query,
      actor,
      {
        actionId: crypto.randomUUID(),
        expectedCurrentVersion: null,
        notes: 'Initial catalog imported from the supplied reference data (reference-only).',
        acknowledgeWarnings: true,
      },
      true,
    );
    return { version: result.version, created: true };
  });
}

/**
 * The current release version, bootstrapping v1 outside production when none
 * exists. In production an operator runs `npm run catalog:bootstrap`.
 */
export async function ensureCatalog(): Promise<number> {
  const current = await getCurrentVersion();
  if (current) return current.version;
  if (!catalogAutoBootstrap())
    throw new DomainError(
      'catalog_unavailable',
      'The catalog is not available yet. Please try again later.',
      503,
    );
  return (await bootstrapCatalog()).version;
}

/**
 * Replace the working copy with the content of release `version` (CATALOG-ADMIN
 * §7.5). Publishing afterwards creates a new version; nothing is rewritten.
 */
export async function restoreToWorkingCopy(actor: string, version: number): Promise<LoadSummary> {
  const db = await getDatabase();
  return db.transaction(async (query) => {
    await query('SELECT pg_advisory_xact_lock($1)', [PUBLISH_LOCK]);
    const [row] = await query<{ snapshot: unknown }>(
      'SELECT snapshot FROM catalog_releases WHERE version=$1',
      [version],
    );
    if (!row) throw new DomainError('not_found', 'That catalog release does not exist.', 404);
    const summary = await loadSnapshotIntoWorkingCopy(query, parseSnapshot(row.snapshot), actor);
    await writeAudit(query, {
      actor,
      action: 'catalog.restored',
      entityType: 'catalog_release',
      entityId: String(version),
      summary: {
        fields: ['working_copy'],
        after: {
          version,
          created: summary.created,
          updated: summary.updated,
          archived: summary.archived,
          deleted: summary.deleted,
        },
      },
    });
    return summary;
  });
}
