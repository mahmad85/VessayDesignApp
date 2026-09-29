import { describe, it, expect, vi, afterEach } from 'vitest';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { PRICING_EXAMPLES, syntheticSnapshot, SYN } from './fixtures/catalog.synthetic';
import { loadSnapshotIntoWorkingCopy, seedLookupTypes } from '../src/db/catalog-admin-repository';
import { LOOKUP_TYPES } from '../src/modules/catalog/lookup-seeds';
import {
  simulation,
  saveCommerce,
  commerceSettings,
  saveBands,
} from '../src/db/pricing-admin-repository';
import {
  saveSupplier,
  putSupplierContact,
  removeSupplierContact,
} from '../src/db/supplier-repository';
import {
  saveMaterial,
  setAvailability,
  setMaterialMedia,
  setMaterialOverrides,
  duplicateMaterial,
  clearReference,
} from '../src/db/material-repository';
import { saveTemplate, setTemplateMedia, duplicateTemplate } from '../src/db/template-repository';
import { workingCatalog } from '../src/db/catalog-working';
import { getAvailability } from '../src/db/availability';
import {
  bootstrapCatalog,
  publish,
  getCurrentVersion,
  getRelease,
  restoreCatalog,
} from '../src/db/release-repository';
import { getDraft } from '../src/db/repository';
import { createSyntheticUser } from './helpers/users';
import { grantRole } from '../src/db/staff-repository';
import { apiRequest } from './helpers/http';
import { GET as studioGet, POST as studioPost } from '../src/app/api/studio/route';
import {
  GET as catalogGet,
  POST as catalogPost,
  PATCH as catalogPatch,
} from '../src/app/api/admin/catalog/[...segments]/route';
const database = setupTestDatabase();
const actor = 'system:test';
const route = (...segments: string[]) => ({ params: Promise.resolve({ segments }) });
afterEach(() => vi.unstubAllEnvs());
describe('SYNTHETIC M4 authoring and publishing contracts', { timeout: PGLITE_TIMEOUT }, () => {
  it('runs E1–E7 through the admin simulator with the same expected customer prices', async () => {
    const db = await database();
    await seedLookupTypes(db.query, LOOKUP_TYPES);
    for (const e of PRICING_EXAMPLES) {
      await db.transaction((q) =>
        loadSnapshotIntoWorkingCopy(q, syntheticSnapshot(e.options), actor, {
          readStatic: async () => Buffer.from('SYNTHETIC image fixture'),
        }),
      );
      const result = await simulation({
        source: 'working',
        productCode: SYN.suit,
        materialCode: e.materialCode,
        includedComponents: e.includedComponents,
        selections: e.selections,
        quantity: e.quantity,
      });
      const { byCategory, ...expected } = { byCategory: undefined, ...e.expected };
      expect(result.quote).toMatchObject(expected);
      if (byCategory && result.quote.status === 'priced')
        expect(
          Object.fromEntries(result.quote.byCategory.map((c) => [c.category, c.amountMinor])),
        ).toEqual(byCategory);
    }
    const current = await commerceSettings();
    const changed = await saveCommerce(
      {
        rowVersion: current.rowVersion,
        currency: 'GBP',
        shipCountries: ['GB'],
        opsTimezone: 'Europe/London',
      },
      actor,
    );
    expect(changed).toMatchObject({ currency: 'GBP', confirmed: true });
    await expect(async () =>
      saveCommerce({ rowVersion: changed.rowVersion, shipCountries: ['ZZ'] }, actor),
    ).rejects.toThrow();
    await saveCommerce({ rowVersion: changed.rowVersion, currency: 'USD' }, actor);
    await expect(saveBands({ items: [] }, actor)).rejects.toMatchObject({ code: 'entity_in_use' });
  });
  it('validates supplier contacts and records no contact values in audit summaries', async () => {
    await expect(
      saveSupplier(
        null,
        {
          code: 'synthetic-invalid',
          name: 'SYNTHETIC invalid',
          kind: 'fabric_mill',
          status: 'active',
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'validation_failed' });
    const supplier = await saveSupplier(
      null,
      {
        code: 'synthetic-mill',
        name: 'SYNTHETIC Mill Ltd',
        kind: 'fabric_mill',
        status: 'active',
        addressLine1: '1 Synthetic Lane',
        city: 'Test City',
        countryCode: 'GB',
        primaryContact: {
          name: 'SYNTHETIC Buyer',
          email: 'buyer@example.com',
          phone: '+44 200 000 0000',
          preferredChannel: 'email',
        },
      },
      actor,
    );
    await expect(async () =>
      putSupplierContact(
        String(supplier.id),
        'secondary',
        { name: 'Bad', phone: 'javascript:bad' },
        actor,
      ),
    ).rejects.toThrow();
    await putSupplierContact(
      String(supplier.id),
      'secondary',
      { name: 'SYNTHETIC Secondary', email: 'secondary@example.com' },
      actor,
    );
    await expect(
      removeSupplierContact(String(supplier.id), 'primary', actor),
    ).rejects.toMatchObject({ code: 'primary_contact_required' });
    await removeSupplierContact(String(supplier.id), 'secondary', actor);
    const rows = await (await database()).query('SELECT summary FROM audit_events');
    expect(JSON.stringify(rows)).not.toMatch(
      /buyer@example|secondary@example|Synthetic Lane|200 000/,
    );
  });
  it('keeps incomplete fabrics as drafts, blocks bad lookups, validates composition at publish and changes availability live', async () => {
    const db = await database();
    const [product] = await db.query("SELECT id FROM products WHERE code='suit'");
    const [supplier] = await db.query("SELECT id FROM suppliers WHERE code='synthetic-mill'");
    const [media] = await db.query('SELECT id FROM media_assets LIMIT 1');
    const fabric = await saveMaterial(
      null,
      {
        code: 'synthetic-fabric',
        name: 'SYNTHETIC fabric',
        status: 'active',
        supplierId: supplier.id,
        primaryHex: '#203c32',
        patternCode: 'solid',
        composition: [{ fibre: 'wool', percent: 60 }],
        usages: ['shell'],
        productIds: [product.id],
      },
      actor,
    );
    expect(fabric).toMatchObject({ status: 'draft', activationMissing: ['swatch image'] });
    await expect(
      saveMaterial(
        String(fabric.id),
        { rowVersion: fabric.rowVersion, patternCode: 'not-a-pattern' },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'validation_failed' });
    await setMaterialMedia(
      String(fabric.id),
      { items: [{ mediaId: media.id, role: 'swatch', sort: 0 }] },
      actor,
    );
    const active = await saveMaterial(
      String(fabric.id),
      { rowVersion: fabric.rowVersion, status: 'active' },
      actor,
    );
    expect((await workingCatalog()).report.errors).toContainEqual(
      expect.objectContaining({ code: 'composition_sum', entityCode: 'synthetic-fabric' }),
    );
    const fixed = await saveMaterial(
      String(fabric.id),
      { rowVersion: active.rowVersion, composition: [{ fibre: 'wool', percent: 100 }] },
      actor,
    );
    expect(
      (await workingCatalog()).report.errors.some((e) => e.entityCode === 'synthetic-fabric'),
    ).toBe(false);
    await setMaterialOverrides(
      String(fabric.id),
      { items: [{ productId: product.id, priceMinor: 100000 }] },
      actor,
    );
    expect((await getAvailability())['synthetic-fabric']).toBe('unknown');
    await setAvailability(
      String(fabric.id),
      { rowVersion: fixed.rowVersion, availability: 'out_of_stock', stockMeters: 0 },
      actor,
    );
    expect((await getAvailability())['synthetic-fabric']).toBe('out_of_stock');
    const copy = await duplicateMaterial(
      String(fabric.id),
      { newCode: 'synthetic-fabric-copy', newName: 'SYNTHETIC copy' },
      actor,
    );
    expect(copy).toMatchObject({ status: 'draft', availability: 'unknown' });
    await expect(
      saveSupplier(String(supplier.id), { rowVersion: 1, code: 'synthetic-renamed' }, actor),
    ).rejects.toMatchObject({ code: 'code_immutable' });
    await expect(async () =>
      clearReference('materials', String(fabric.id), { confirmation: 'yes' }, actor),
    ).rejects.toThrow();
  });
  it('publishes, rejects stale warning acknowledgements, restores idempotently and preserves look provenance', async () => {
    // Reset to the reference seed without real supplier facts. All activity stays local.
    await bootstrapCatalog();
    const db = await database();
    const [product] = await db.query("SELECT * FROM products WHERE code='suit'");
    const [material] = await db.query('SELECT * FROM materials WHERE id=$1', [
      product.default_material_id,
    ]);
    const [media] = await db.query('SELECT id FROM media_assets LIMIT 1');
    const look = await saveTemplate(
      null,
      {
        code: 'synthetic-publish-look',
        name: 'SYNTHETIC Published Look',
        productId: product.id,
        materialId: material.id,
        status: 'active',
      },
      actor,
    );
    await expect(async () =>
      setTemplateMedia(
        String(look.id),
        { items: [{ mediaId: media.id, role: 'gallery', sort: 0 }] },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'validation_failed' });
    await setTemplateMedia(
      String(look.id),
      { items: [{ mediaId: media.id, role: 'hero', sort: 0 }] },
      actor,
    );
    const copy = await duplicateTemplate(
      String(look.id),
      { newCode: 'synthetic-look-copy', newName: 'SYNTHETIC copy' },
      actor,
    );
    expect(copy.status).toBe('draft');
    const current = await getCurrentVersion();
    const input = {
      actionId: crypto.randomUUID(),
      expectedCurrentVersion: current!.version,
      notes: 'SYNTHETIC publish',
      acknowledgeWarnings: true,
      warningsChecksum: 'stale',
    };
    await expect(publish(actor, input)).rejects.toMatchObject({ code: 'warnings_unacknowledged' });
    const report = (await workingCatalog()).report;
    const result = await publish(actor, { ...input, warningsChecksum: report.warningsChecksum });
    expect(
      (await getRelease(result.version))!.snapshot.templates.some(
        (t) => t.code === 'synthetic-publish-look',
      ),
    ).toBe(true);
    const action = {
      actionId: crypto.randomUUID(),
      publishImmediately: false,
      notes: 'SYNTHETIC restore',
    };
    expect(await restoreCatalog(actor, current!.version, action)).toEqual({ restored: true });
    expect(await restoreCatalog(actor, current!.version, action)).toEqual({ restored: true });
  });
  it('enforces permissions and isolates staff preview commands from customer drafts', async () => {
    vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
    const owner = await createSyntheticUser();
    await grantRole({ email: owner.email, role: 'owner' }, actor);
    const customer = await createSyntheticUser();
    const reader = await createSyntheticUser();
    await grantRole({ email: reader.email, role: 'order_manager' }, actor);
    const denied = await studioGet(
      apiRequest('/api/studio?catalog=working', { cookies: customer.cookie }),
    );
    expect(denied.status).toBe(403);
    const customerDraft = await getDraft(`user:${owner.userId}`);
    const state = await (
      await studioGet(apiRequest('/api/studio?catalog=working', { cookies: owner.cookie }))
    ).json();
    expect(state.isPreview).toBe(true);
    expect(state.draft.id).not.toBe(customerDraft.id);
    const response = await studioPost(
      apiRequest('/api/studio?catalog=working', {
        method: 'POST',
        cookies: owner.cookie,
        json: {
          actionId: crypto.randomUUID(),
          expectedRevision: 0,
          command: { type: 'add_garment', productCode: 'suit' },
        },
      }),
    );
    expect(response.status).toBe(200);
    const preview = await response.json();
    expect(preview.draft.garments).toHaveLength(1);
    expect((await getDraft(`user:${owner.userId}`)).garments).toHaveLength(0);
    expect(
      (
        await catalogGet(
          apiRequest('/api/admin/catalog/products', { cookies: reader.cookie }),
          route('products'),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await catalogPost(
          apiRequest('/api/admin/catalog/products', {
            method: 'POST',
            cookies: reader.cookie,
            json: {},
          }),
          route('products'),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await catalogPost(
          apiRequest('/api/admin/catalog/publish', {
            method: 'POST',
            cookies: reader.cookie,
            json: {},
          }),
          route('publish'),
        )
      ).status,
    ).toBe(403);
    const [product] = await (await database()).query("SELECT * FROM products WHERE code='suit'");
    const invalid = await catalogPatch(
      apiRequest(`/api/admin/catalog/products/${product.id}`, {
        method: 'PATCH',
        cookies: owner.cookie,
        json: { rowVersion: product.row_version, name: '' },
      }),
      route('products', String(product.id)),
    );
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error.details.fields).toContainEqual(
      expect.objectContaining({ path: 'name' }),
    );
  });
});
