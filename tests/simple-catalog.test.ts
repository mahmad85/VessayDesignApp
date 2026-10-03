import { describe, expect, it } from 'vitest';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { bootstrapCatalog } from '../src/db/release-repository';
import {
  copyProduct,
  createStructure,
  createSubcategory,
  deleteCatalogEntity,
  editStructure,
  listStructure,
} from '../src/db/catalog-structure-repository';
import { saveBands } from '../src/db/pricing-admin-repository';
import { loadSnapshotIntoWorkingCopy, loadWorkingRows } from '../src/db/catalog-admin-repository';
import { compileWorkingCopy } from '../src/modules/catalog/compile';
import { indexSnapshot } from '../src/modules/catalog/snapshot';
import { newGarment } from '../src/modules/catalog/garment';
import { quoteGarment } from '../src/modules/pricing/quote';

// D-022: the simplified admin. One base price per product plus one uplift per
// fabric tier; new products start as copies; a subcategory is created whole.
// Every name and amount is SYNTHETIC.

const database = setupTestDatabase();
const actor = 'system:test';
const compile = async () => compileWorkingCopy(await loadWorkingRows((await database()).query));
const suitRow = async () => (await listStructure('products')).find((p) => p.code === 'suit')!;

describe('SYNTHETIC simplified catalog admin (D-022)', { timeout: PGLITE_TIMEOUT }, () => {
  it('prices each fabric tier as the base price plus the tier uplift', async () => {
    await bootstrapCatalog();
    const db = await database();
    // Migration 0007's tiers; only the Classic tier gets an uplift.
    const bands = await db.query<{ code: string; name: string; sort: number }>(
      'SELECT code,name,sort FROM price_bands ORDER BY sort',
    );
    expect(bands.map((b) => b.code)).toEqual(['ESS', 'CLS', 'PRM', 'LUX']);
    await saveBands(
      { items: bands.map((b) => ({ ...b, ...(b.code === 'CLS' && { upliftMinor: 10000 }) })) },
      actor,
    );
    const suit = await suitRow();
    const [fabric] = await db.query<{ code: string }>(
      'SELECT m.code FROM materials m JOIN products p ON p.default_material_id=m.id WHERE p.id=$1',
      [suit.id],
    );
    await db.query("UPDATE materials SET price_band_code='CLS' WHERE code=$1", [fabric.code]);
    // A band price stored before D-022 no longer applies once a base price is set.
    await db.query(
      "INSERT INTO product_band_prices(product_id,band_code,price_minor) VALUES($1,'CLS',1)",
      [suit.id],
    );
    await editStructure(
      'products',
      String(suit.id),
      { basePriceMinor: 69900, rowVersion: suit.rowVersion },
      actor,
    );
    const snapshot = await compile();
    const product = snapshot.products.find((p) => p.code === 'suit')!;
    expect(product.basePriceMinor).toBe(69900);
    expect(product.bandPrices).toEqual({ ESS: 69900, CLS: 79900, PRM: 69900, LUX: 69900 });
    expect(snapshot.priceBands.find((b) => b.code === 'CLS')).toMatchObject({ upliftMinor: 10000 });
    expect(snapshot.priceBands.find((b) => b.code === 'ESS')).not.toHaveProperty('upliftMinor');
    const index = indexSnapshot(snapshot);
    const quote = quoteGarment(index, newGarment(index, 'suit', crypto.randomUUID()));
    expect(quote).toMatchObject({ status: 'priced', unitMinor: 79900 });

    // Restoring that release into the working copy keeps the base price and uplift.
    await db.transaction((query) => loadSnapshotIntoWorkingCopy(query, snapshot, actor));
    const [stored] = await db.query('SELECT base_price_minor FROM products WHERE id=$1', [suit.id]);
    expect(stored.base_price_minor).toBe(69900);
    expect(
      await db.query('SELECT 1 FROM product_band_prices WHERE product_id=$1', [suit.id]),
    ).toEqual([]);
    expect(await compile()).toEqual(snapshot);
  });

  it('copies a product as a draft with its parts, on/off choices, fabrics and price', async () => {
    await bootstrapCatalog();
    const db = await database();
    const suit = await suitRow();
    const count = async (table: string, id: unknown) =>
      (
        await db.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ${table} WHERE product_id=$1`,
          [id],
        )
      )[0].n;
    const copy = await copyProduct(String(suit.id), { name: 'SYNTHETIC Wedding Suit' }, actor);
    expect(copy).toMatchObject({
      code: 'synthetic-wedding-suit',
      name: 'SYNTHETIC Wedding Suit',
      shortLabel: 'SYNTHETIC Wedding Suit',
      status: 'draft',
      measurementSet: suit.measurementSet,
      basePriceMinor: suit.basePriceMinor,
    });
    for (const table of ['product_components', 'product_option_settings', 'material_products'])
      expect(await count(table, copy.id), table).toBe(await count(table, suit.id));
    expect(await count('material_products', copy.id)).toBeGreaterThan(0);
    const again = await copyProduct(String(suit.id), { name: 'SYNTHETIC Wedding Suit' }, actor);
    expect(again.code).toBe('synthetic-wedding-suit-2');
    // An unpublished copy can be deleted with everything it owns.
    await deleteCatalogEntity('products', String(again.id), actor);
    for (const table of ['product_components', 'product_option_settings', 'material_products'])
      expect(await count(table, again.id), table).toBe(0);
  });

  it('creates a subcategory as one active group holding one choice option', async () => {
    await bootstrapCatalog();
    const jacket = (await listStructure('components')).find((c) => c.code === 'jacket')!;
    const { group, attribute } = await createSubcategory(
      String(jacket.id),
      { name: 'SYNTHETIC Lapel Pin', kind: 'accent' },
      actor,
    );
    expect(group).toMatchObject({
      code: 'accents.jacket.synthetic-lapel-pin',
      name: 'SYNTHETIC Lapel Pin',
      kind: 'accent',
      lineKind: 'accessory',
      status: 'active',
    });
    expect(attribute).toMatchObject({
      groupId: group.id,
      name: 'SYNTHETIC Lapel Pin',
      inputType: 'choice',
      status: 'active',
    });
    const again = await createSubcategory(
      String(jacket.id),
      { name: 'SYNTHETIC Lapel Pin', kind: 'accent' },
      actor,
    );
    expect(again.group.code).toBe('accents.jacket.synthetic-lapel-pin-2');
    await createStructure(
      'values',
      { label: 'SYNTHETIC Gold', surchargeMinor: 1500, status: 'active', isDefault: true },
      actor,
      String(attribute.id),
    );
    const compiled = (await compile()).components
      .find((c) => c.code === 'jacket')!
      .groups.find((g) => g.code === group.code)!;
    expect(compiled.attributes[0].values).toMatchObject([
      { label: 'SYNTHETIC Gold', surchargeMinor: 1500 },
    ]);
    // Groups no longer take a charge.
    await expect(
      editStructure(
        'groups',
        String(group.id),
        { surchargeMinor: 100, rowVersion: group.rowVersion },
        actor,
      ),
    ).rejects.toThrow();
  });
});
