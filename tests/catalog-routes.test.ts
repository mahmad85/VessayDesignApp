import { describe, it, expect } from 'vitest';
import { GET as getCurrent } from '../src/app/api/catalog/current/route';
import { GET as getVersion } from '../src/app/api/catalog/v/[version]/route';
import { GET as getMedia } from '../src/app/api/media/[id]/route';
import { GET as getStudio, POST as postStudio } from '../src/app/api/studio/route';
import { publish } from '../src/db/release-repository';
import {
  AVAILABILITY_TTL_MS,
  bustAvailabilityCache,
  getAvailability,
} from '../src/db/availability';
import { customerCatalogSchema } from '../src/modules/catalog/snapshot';
import { nameBasedId } from '../src/modules/catalog/import-legacy';
import type { CommandV2 } from '../src/modules/configuration/types';
import { PGLITE_TIMEOUT, setupTestDatabase } from './helpers/db';
import { apiRequest, cookiesFrom } from './helpers/http';

// WP-13: public catalog and media routes, the live availability overlay and
// the studio envelope (API-REFERENCE §2.2–2.3, ADMIN-BACKEND §6, §9).
// Reference import only; the release edits are SYNTHETIC.

const database = setupTestDatabase();
const LAPEL = 'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type';
const params = <T>(value: T) => ({ params: Promise.resolve(value) });

async function studio(cookie?: string) {
  const response = await getStudio(apiRequest('/api/studio', { cookies: cookie }));
  return { response, body: await response.json(), cookie: cookie ?? cookiesFrom(response) };
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
/** Publishes the working copy as the next release with its warnings acknowledged. */
async function publishNext(expectedCurrentVersion: number) {
  const first = await publish('user:synthetic-admin', {
    actionId: crypto.randomUUID(),
    expectedCurrentVersion,
    acknowledgeWarnings: false,
  }).catch((e) => e);
  return publish('user:synthetic-admin', {
    actionId: crypto.randomUUID(),
    expectedCurrentVersion,
    acknowledgeWarnings: true,
    warningsChecksum: first.details.report.warningsChecksum,
  });
}

describe('public catalog routes', { timeout: PGLITE_TIMEOUT }, () => {
  it('reports the current version without caching', async () => {
    const response = await getCurrent();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ version: 1 });
  });

  it('serves a release projection immutably, without internal fields', async () => {
    const response = await getVersion(apiRequest('/api/catalog/v/1'), params({ version: '1' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(response.headers.get('content-type')).toContain('application/json');
    const text = await response.text();
    const catalog = customerCatalogSchema.parse(JSON.parse(text));
    expect(catalog.version).toBe(1);
    for (const internal of [
      'supplierCode',
      'legacyKey',
      'referencePrice',
      'referenceMenuPrice',
      'sourceLabel',
      'sourcePrice',
      'rightsStatus',
      'articleCode',
    ])
      expect(text, internal).not.toContain(`"${internal}`);
    expect(catalog.materials.every((material) => material.supplier === null)).toBe(true);
  });

  it('answers 404 for an unknown or malformed version', async () => {
    for (const version of ['99', 'abc', '0', '-1', '1.5']) {
      const response = await getVersion(
        apiRequest(`/api/catalog/v/${version}`),
        params({ version }),
      );
      expect(response.status, version).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect((await response.json()).error.code).toBe('not_found');
    }
  });

  it('redirects static media permanently and hides unknown media', async () => {
    const id = nameBasedId('static:/reference-assets/fabrics/navy-twill.svg');
    const response = await getMedia(apiRequest(`/api/media/${id}`), params({ id }));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/reference-assets/fabrics/navy-twill.svg');
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    for (const unknown of [crypto.randomUUID(), '../etc/passwd'])
      expect(
        (await getMedia(apiRequest('/api/media/x'), params({ id: unknown }))).status,
        unknown,
      ).toBe(404);
  });
});

describe('studio envelope and catalog updates', { timeout: PGLITE_TIMEOUT }, () => {
  it('returns the draft with the catalog version, updates, quote and availability', async () => {
    const { response, body } = await studio();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      catalogVersion: 1,
      catalogUpdates: [],
      // Empty cart: no price, and never a zero total.
      quote: { status: 'unavailable', currency: 'USD', garments: [], totalMinor: null },
      user: null,
      assistantMode: 'guided',
      draft: { schemaVersion: 2, garments: [] },
    });
    expect(body.availability).toMatchObject({ 'navy-twill': 'unknown', ivory: 'unknown' });
  });

  it('overlays live availability, cached for a minute and busted by edits', async () => {
    const { cookie } = await studio();
    const db = await database();
    await db.query("UPDATE materials SET availability='out_of_stock' WHERE code='forest'");
    // Still cached until the TTL passes or an edit busts it.
    expect((await getAvailability()).forest).toBe('unknown');
    expect((await getAvailability(Date.now() + AVAILABILITY_TTL_MS + 1)).forest).toBe(
      'out_of_stock',
    );
    bustAvailabilityCache();
    expect((await studio(cookie)).body.availability.forest).toBe('out_of_stock');
    const added = await command(cookie, 0, { type: 'add_garment', productCode: 'suit' });
    expect(added.status).toBe(200);
    const refused = await command(cookie, 1, { type: 'design', patch: { materialCode: 'forest' } });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('material_unavailable');
    await db.query("UPDATE materials SET availability='unknown' WHERE code='forest'");
    bustAvailabilityCache();
  });

  it('reports a garment whose choice left the catalog and rebases it with consent', async () => {
    const { cookie } = await studio();
    await command(cookie, 0, { type: 'add_garment', productCode: 'suit' });
    const peak = await command(cookie, 1, {
      type: 'design',
      patch: { selections: { [LAPEL]: 'peak' } },
    });
    expect(peak.status).toBe(200);
    const garmentId = peak.body.draft.activeGarmentId;
    // SYNTHETIC admin change: withdraw the peak lapel and publish v2.
    const db = await database();
    await db.query(
      "UPDATE option_values SET status='archived' WHERE code='peak' AND attribute_id=(SELECT id FROM attributes WHERE code=$1)",
      [LAPEL],
    );
    expect((await publishNext(1)).version).toBe(2);
    const read = await studio(cookie);
    expect(read.body.catalogVersion).toBe(2);
    expect(read.body.catalogUpdates).toEqual([
      {
        garmentId,
        impact: [
          {
            garmentId,
            kind: 'selection_replaced',
            attributeCode: LAPEL,
            from: 'peak',
            to: 'standard',
            message: 'Lapel style: Peak is no longer offered and changes to Notch.',
          },
        ],
      },
    ]);
    const blocked = await command(cookie, 2, {
      type: 'design',
      patch: { selections: { 'style.jacket.jacket_fit.jacket-fit': '0' } },
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatchObject({
      code: 'catalog_update_required',
      details: { garmentId, impact: read.body.catalogUpdates[0].impact },
    });
    const rebased = await command(cookie, 2, {
      type: 'rebase_catalog',
      garmentId,
      confirmImpact: true,
    });
    expect(rebased.status).toBe(200);
    expect(rebased.body.catalogUpdates).toEqual([]);
    expect(rebased.body.draft.garments[0]).toMatchObject({
      catalogVersion: 2,
      selections: { [LAPEL]: 'standard' },
    });
    // The old release stays served for anyone still holding it.
    const v1 = await getVersion(apiRequest('/api/catalog/v/1'), params({ version: '1' }));
    expect(v1.status).toBe(200);
  });
});
