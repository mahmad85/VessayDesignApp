import { DomainError } from '@/modules/configuration/types';
import type { CatalogSnapshot } from '@/modules/catalog/snapshot';
import { valueKey } from '@/modules/catalog/snapshot';
import { getDatabase } from './client';
import { loadSnapshotIntoWorkingCopy } from './catalog-admin-repository';
import {
  PUBLISH_LOCK,
  ensureCatalog,
  getRelease,
  publish,
  restoreToWorkingCopy,
} from './release-repository';

// Browser-test support only (TASK-017 e2e). It publishes SYNTHETIC prices on
// top of the current release, or restores the imported reference release, so
// the price display can be checked end to end on the Playwright database. It is
// off unless VESSY_E2E_HOOKS=true and can never run in production.

const ACTOR = 'system:browser_tests';

export function e2eHooksEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.VESSY_E2E_HOOKS === 'true';
}

/**
 * SYNTHETIC prices mirroring the PRICING.md worked examples on the reference
 * catalog: band B (suit 79900, shirt 12900, blazer 59900), every fabric in band
 * B except `forest` (left unpriced), the vest 10000, the Berck lining 900 and
 * working buttonholes 1000 (no group fees, D-022). Not commercial data.
 */
export function withSyntheticPrices(snapshot: CatalogSnapshot): CatalogSnapshot {
  const next = structuredClone(snapshot);
  const bandPrice: Record<string, number> = { suit: 79900, shirt: 12900, blazer: 59900 };
  next.priceBands = [{ code: 'B', name: 'Band B (SYNTHETIC)', sort: 2 }];
  for (const product of next.products) {
    if (bandPrice[product.code]) product.bandPrices = { B: bandPrice[product.code] };
    for (const link of product.components)
      if (link.componentCode === 'vest') link.surchargeMinor = 10000;
  }
  for (const material of next.materials)
    material.priceBand = material.code === 'forest' ? null : 'B';
  const surcharges: Record<string, number> = {
    [valueKey('accents.jacket.lining.lining-fabrics', '98')]: 900,
    [valueKey('style.jacket.jacket_sleeve_buttons_combinated.jacket-sleeve-buttonholes', '1')]:
      1000,
  };
  for (const component of next.components)
    for (const group of component.groups) {
      for (const attribute of group.attributes)
        for (const value of attribute.values) {
          const amount = surcharges[valueKey(attribute.code, value.code)];
          if (amount !== undefined) value.surchargeMinor = amount;
        }
    }
  return next;
}

/** Publish the working copy with its current warnings acknowledged, as the admin screen does. */
async function publishWorkingCopy(expectedCurrentVersion: number, notes: string) {
  const attempt = (warningsChecksum?: string) =>
    publish(ACTOR, {
      actionId: crypto.randomUUID(),
      expectedCurrentVersion,
      notes,
      acknowledgeWarnings: warningsChecksum !== undefined,
      warningsChecksum,
    });
  try {
    return (await attempt()).version;
  } catch (e) {
    if (!(e instanceof DomainError)) throw e;
    if (e.code === 'nothing_to_publish') return expectedCurrentVersion;
    if (e.code !== 'warnings_unacknowledged') throw e;
    const report = e.details?.report as { warningsChecksum: string };
    return (await attempt(report.warningsChecksum)).version;
  }
}

export async function publishE2ECatalog(scenario: 'priced' | 'reference') {
  if (!e2eHooksEnabled()) throw new DomainError('not_found', 'Not found.', 404);
  const current = await ensureCatalog();
  if (scenario === 'reference') {
    await restoreToWorkingCopy(ACTOR, 1);
    return { version: await publishWorkingCopy(current, 'SYNTHETIC e2e: reference catalog') };
  }
  const release = await getRelease(current);
  if (!release) throw new DomainError('catalog_unavailable', 'No catalog release.', 503);
  const priced = withSyntheticPrices(release.snapshot);
  const db = await getDatabase();
  await db.transaction(async (query) => {
    await query('SELECT pg_advisory_xact_lock($1)', [PUBLISH_LOCK]);
    await loadSnapshotIntoWorkingCopy(query, priced, ACTOR);
  });
  return { version: await publishWorkingCopy(current, 'SYNTHETIC e2e: priced catalog') };
}
