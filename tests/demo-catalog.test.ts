import { describe, expect, it } from 'vitest';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { bootstrapCatalog } from '../src/db/release-repository';
import { workingCatalog } from '../src/db/catalog-working';
import { applyDemoCatalog } from '../src/db/demo-catalog';

// D-023: the demo catalog step leaves no publish warnings, keeps what an admin
// entered, and changes nothing on a second run.

const database = setupTestDatabase();

describe('demo catalog (D-023)', { timeout: PGLITE_TIMEOUT }, () => {
  it('fills the reference catalog so a publish has no errors or warnings', async () => {
    await bootstrapCatalog();
    const db = await database();
    const before = (await workingCatalog()).report;
    expect(before.warnings.length).toBeGreaterThan(0);
    // An admin's own values are kept.
    await db.query("UPDATE products SET base_price_minor=99900 WHERE code='suit'");
    await db.query("UPDATE materials SET price_band_code='LUX' WHERE code='charcoal'");

    const summary = await db.transaction((query) => applyDemoCatalog(query, 'system:demo_seed'));
    expect(summary).toMatchObject({ basePrices: 2, tierUplifts: 3 });
    const { report, snapshot } = await workingCatalog();
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(snapshot.referenceOnly).toBe(false);

    const [suit] = await db.query("SELECT base_price_minor FROM products WHERE code='suit'");
    expect(suit.base_price_minor).toBe(99900);
    const [charcoal] = await db.query(
      "SELECT price_band_code, supplier_article_code FROM materials WHERE code='charcoal'",
    );
    expect(charcoal).toEqual({ price_band_code: 'LUX', supplier_article_code: 'DEMO-CHARCOAL' });
    const [point] = await db.query(
      "SELECT m.storage_key, m.rights_status FROM option_values v JOIN media_assets m ON m.id=v.image_media_id WHERE v.code='point'",
    );
    expect(point).toEqual({
      storage_key: '/reference-assets/demo/shirt-collar-point.svg',
      rights_status: 'owned',
    });

    const again = await db.transaction((query) => applyDemoCatalog(query, 'system:demo_seed'));
    expect(Object.values(again).every((n) => n === 0)).toBe(true);
  });
});
