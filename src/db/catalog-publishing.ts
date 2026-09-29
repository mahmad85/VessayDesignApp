import { z } from 'zod';
import { diffSnapshots } from '@/modules/catalog/diff';
import { pageQuery } from '@/lib/admin-http';
import { workingCatalog } from './catalog-working';
import { getCurrentVersion, getRelease } from './release-repository';
import { getDatabase } from './client';
import { dto, missing } from './admin-mutations';
export async function catalogStatus() {
  const live = await getCurrentVersion();
  const working = await workingCatalog();
  return {
    currentVersion: live?.version ?? null,
    currentChecksum: live?.checksum ?? null,
    workingChecksum: working.workingChecksum,
    unpublished: live?.checksum !== working.workingChecksum,
    errors: working.report.errors.length,
    warnings: working.report.warnings.length,
    currentReferenceOnly: live?.referenceOnly ?? null,
  };
}
export async function catalogDiff() {
  const live = await getCurrentVersion();
  const working = await workingCatalog();
  const before = live
    ? (await getRelease(live.version))!.snapshot
    : {
        ...working.snapshot,
        products: [],
        components: [],
        materials: [],
        templates: [],
        rules: [],
        lookups: {},
        priceBands: [],
        media: {},
      };
  return diffSnapshots(before, working.snapshot);
}
export async function listReleases(input: unknown) {
  const f = pageQuery.parse(input);
  const cursor = f.cursor ? z.coerce.number().int().positive().parse(f.cursor) : null;
  const rows = await (
    await getDatabase()
  ).query(
    'SELECT version,published_at,published_by,notes,reference_only,restored_from_version FROM catalog_releases WHERE ($1::integer IS NULL OR version<$1) ORDER BY version DESC LIMIT $2',
    [cursor, f.limit + 1],
  );
  return {
    items: rows.slice(0, f.limit).map(dto),
    nextCursor: rows.length > f.limit ? String(rows[f.limit - 1].version) : null,
  };
}
export async function releaseDetail(version: string) {
  const number = z.coerce.number().int().positive().parse(version);
  const [row] = await (
    await getDatabase()
  ).query(
    'SELECT version,published_at,published_by,notes,reference_only,restored_from_version,validation FROM catalog_releases WHERE version=$1',
    [number],
  );
  if (!row) missing();
  return { ...dto(row), snapshotUrl: `/api/admin/catalog/releases/${number}/snapshot` };
}
