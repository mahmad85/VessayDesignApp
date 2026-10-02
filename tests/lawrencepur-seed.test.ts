import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { bootstrapCatalog, getRelease, getCurrentVersion } from '../src/db/release-repository';
import { materialInput } from '../src/modules/catalog/material-input';
import { PGLITE_TIMEOUT, setupTestDatabase } from './helpers/db';

// Migration 0007 seeds Lawrencepur's published fabrics as reference-only
// drafts. It must never publish, price or stock anything on its own.
const database = setupTestDatabase('vessy-lawrencepur-');
type Seed = { materials: Array<Record<string, unknown> & { id: string; code: string }> };
const seed = async () =>
  JSON.parse(await readFile('assets/catalog-source/lawrencepur/fabrics.json', 'utf8')) as Seed;
const migrationSql = () => readFile('migrations/0007_lawrencepur_fabrics.sql', 'utf8');

describe('Lawrencepur fabric seed', { timeout: PGLITE_TIMEOUT }, () => {
  it('has records the admin material form accepts', async () => {
    const { materials } = await seed();
    expect(materials).toHaveLength(228);
    expect(materials.some((m) => /shalwar/i.test(String(m.name)))).toBe(false);
    for (const m of materials) expect(m.metadata).toEqual({});
    for (const m of materials)
      expect(
        (m.composition as { percent: number }[]).reduce((s, x) => s + x.percent, 0),
        m.code,
      ).toBe(100);
    expect(new Set(materials.map((m) => m.code)).size).toBe(materials.length);
    for (const m of materials) {
      const fields = Object.fromEntries(
        Object.entries(m).filter(
          ([k]) =>
            ![
              'id',
              'referenceOnly',
              'supplierCode',
              'productCodes',
              'availability',
              'metadata',
            ].includes(k),
        ),
      );
      const parsed = materialInput.safeParse(fields);
      expect(parsed.success, `${m.code}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it('inserts reference-only, banded drafts linked to existing products', async () => {
    const db = await database();
    // A deployed database already has its catalog when 0007 arrives. Here
    // PGlite ran 0007 on connect, before bootstrap archived the unknown rows.
    await bootstrapCatalog();
    await db.query("DELETE FROM materials WHERE id LIKE 'mat-lawrencepur-%'");
    for (const statement of (await migrationSql()).split(';').filter((s) => s.trim()))
      await db.query(statement);
    const rows = await db.query<{
      status: string;
      reference_only: boolean;
      price_band_code: string | null;
      availability: string;
      stock_meters: string | null;
      supplier_code: string;
    }>(
      "SELECT m.status, m.reference_only, m.price_band_code, m.availability, m.stock_meters, s.code AS supplier_code FROM materials m JOIN suppliers s ON s.id = m.supplier_id WHERE m.code LIKE 'lawrencepur.%'",
    );
    expect(rows).toHaveLength(228);
    const prices = await db.query(
      "SELECT 1 FROM product_band_prices WHERE band_code IN ('ESS','CLS','PRM','LUX')",
    );
    expect(prices).toHaveLength(0);
    for (const row of rows)
      expect(row).toEqual({
        status: 'draft',
        reference_only: true,
        price_band_code: expect.stringMatching(/^(ESS|CLS|PRM|LUX)$/),
        availability: 'unknown',
        stock_meters: null,
        supplier_code: 'lawrencepur',
      });
    const links = await db.query<{ code: string; n: number }>(
      "SELECT p.code, count(*)::int AS n FROM material_products mp JOIN products p ON p.id = mp.product_id WHERE mp.material_id LIKE 'mat-lawrencepur-%' GROUP BY p.code ORDER BY p.code",
    );
    const { materials } = await seed();
    const expected = (code: string) =>
      materials.filter((m) => (m.productCodes as string[]).includes(code)).length;
    expect(links).toEqual(['blazer', 'shirt', 'suit'].map((code) => ({ code, n: expected(code) })));
  });

  it('keeps admin edits when it runs again and publishes nothing', async () => {
    const db = await database();
    const current = await getCurrentVersion();
    const [first] = (await seed()).materials;
    await db.query("UPDATE materials SET name = 'Edited by admin' WHERE id = $1", [first.id]);
    for (const statement of (await migrationSql()).split(';').filter((s) => s.trim()))
      await db.query(statement);
    const [row] = await db.query<{ name: string }>('SELECT name FROM materials WHERE id = $1', [
      first.id,
    ]);
    expect(row.name).toBe('Edited by admin');
    expect(await getCurrentVersion()).toEqual(current);
    const release = await getRelease(current!.version);
    expect(JSON.stringify(release?.snapshot)).not.toContain('lawrencepur.');
  });
});
