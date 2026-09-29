import { describe, it, expect, afterEach } from 'vitest';
import { GET as getStudio, POST as postStudio } from '../src/app/api/studio/route';
import { POST as postTestCatalog } from '../src/app/api/test/catalog/route';
import { e2eHooksEnabled, withSyntheticPrices } from '../src/db/e2e-catalog';
import { importLegacyCatalog } from '../src/modules/catalog/import-legacy';
import { validateRelease } from '../src/modules/catalog/validate-release';
import type { CommandV2 } from '../src/modules/configuration/types';
import { PGLITE_TIMEOUT, setupTestDatabase } from './helpers/db';
import { apiRequest, cookiesFrom } from './helpers/http';

// WP-18: the live quote in studio responses, the quote-derived review finding
// and the browser-test price hook. SYNTHETIC prices on the reference catalog.

setupTestDatabase();
const LINING = 'accents.jacket.lining';
const env = process.env as Record<string, string | undefined>;
afterEach(() => {
  delete env.VESSY_E2E_HOOKS;
});

async function studio(cookie?: string) {
  const response = await getStudio(apiRequest('/api/studio', { cookies: cookie }));
  return { body: await response.json(), cookie: cookie ?? cookiesFrom(response) };
}
async function command(cookie: string, expectedRevision: number, c: CommandV2) {
  const response = await postStudio(
    apiRequest('/api/studio', {
      cookies: cookie,
      json: { actionId: crypto.randomUUID(), expectedRevision, command: c },
    }),
  );
  return { status: response.status, body: await response.json() };
}
const hook = (scenario: string) =>
  postTestCatalog(apiRequest('/api/test/catalog', { json: { scenario } }));

describe('SYNTHETIC price overlay for browser tests', () => {
  it('prices the reference catalog like the PRICING.md fixture and still validates', () => {
    const priced = withSyntheticPrices(importLegacyCatalog().snapshot);
    const report = validateRelease(priced);
    expect(report.errors).toEqual([]);
    const suit = priced.products.find((product) => product.code === 'suit')!;
    expect(suit.bandPrices).toEqual({ B: 79900 });
    expect(suit.components.find((link) => link.componentCode === 'vest')!.surchargeMinor).toBe(
      10000,
    );
    expect(priced.materials.find((material) => material.code === 'forest')!.priceBand).toBeNull();
  });

  it('is off unless enabled, and never in production', () => {
    expect(e2eHooksEnabled()).toBe(false);
    env.VESSY_E2E_HOOKS = 'true';
    expect(e2eHooksEnabled()).toBe(true);
    const nodeEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    expect(e2eHooksEnabled()).toBe(false);
    env.NODE_ENV = nodeEnv;
  });
});

describe('the live quote in studio responses', { timeout: PGLITE_TIMEOUT }, () => {
  it('reports the imported catalog as unpriced, and the review keeps the quote blocker', async () => {
    expect((await hook('priced')).status).toBe(404);
    const { cookie } = await studio();
    const added = await command(cookie, 0, { type: 'add_garment', productCode: 'suit' });
    expect(added.body.quote).toMatchObject({
      status: 'unavailable',
      totalMinor: null,
      garments: [{ status: 'unavailable', reasons: ['base_price_missing'] }],
    });
    const reviewed = await command(cookie, 1, { type: 'review', mode: 'automated' });
    expect(reviewed.body.draft.review.findings.map((f: { id: string }) => f.id)).toContain(
      'quote-unavailable',
    );
  });

  it('prices an open draft on its next read after a priced release (PRC-007)', async () => {
    const { cookie } = await studio();
    await command(cookie, 0, { type: 'add_garment', productCode: 'suit' });
    env.VESSY_E2E_HOOKS = 'true';
    const published = await hook('priced');
    expect(published.status).toBe(200);
    const { version } = await published.json();
    const read = await studio(cookie);
    expect(read.body.catalogVersion).toBe(version);
    // The garment is still pinned to v1; the price comes from the current release.
    expect(read.body.draft.garments[0].catalogVersion).toBe(1);
    expect(read.body.catalogUpdates).toEqual([]);
    expect(read.body.quote).toMatchObject({
      status: 'priced',
      subtotalMinor: 79900,
      shippingMinor: 0,
      totalMinor: 79900,
    });
    // E3 on the reference catalog: vest, custom lining with Berck, working buttonholes, peak lapel.
    const e3 = await command(cookie, 1, {
      type: 'design',
      patch: {
        components: { vest: true },
        selections: {
          [`${LINING}.internal-lining`]: 'personalizado',
          [`${LINING}.lining-fabrics`]: '98',
          'style.jacket.jacket_sleeve_buttons_combinated.jacket-sleeve-buttonholes': '1',
          'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type': 'peak',
        },
      },
    });
    expect(e3.status).toBe(200);
    expect(e3.body.quote.garments[0]).toMatchObject({ status: 'priced', unitMinor: 93400 });
    expect(
      Object.fromEntries(
        e3.body.quote.garments[0].byCategory.map((c: { category: string; amountMinor: number }) => [
          c.category,
          c.amountMinor,
        ]),
      ),
    ).toEqual({ base: 79900, jacket: 1000, vest: 10000, accents: 2500 });
    const reviewed = await command(cookie, 2, { type: 'review', mode: 'automated' });
    expect(reviewed.body.draft.review.findings.map((f: { id: string }) => f.id)).not.toContain(
      'quote-unavailable',
    );
    expect(reviewed.body.draft.review.checkoutEligible).toBe(false);
    // An unpriced fabric makes the quote unavailable again, never zero.
    const forest = await command(cookie, 3, { type: 'design', patch: { materialCode: 'forest' } });
    expect(forest.body.quote).toMatchObject({
      status: 'unavailable',
      totalMinor: null,
      garments: [{ reasons: ['base_price_missing'] }],
    });
    // Restoring the reference catalog publishes it again as the next version.
    const restored = await hook('reference');
    expect((await restored.json()).version).toBe(version + 1);
    expect((await studio(cookie)).body.quote.status).toBe('unavailable');
  });
});
