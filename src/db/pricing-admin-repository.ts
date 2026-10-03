import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import { codeSchema } from '@/modules/catalog/snapshot';
import { moneyInput, rowVersionInput } from '@/modules/catalog/admin-input';
import { quoteGarment } from '@/modules/pricing/quote';
import { newGarment, applyGarmentPatch } from '@/modules/catalog/garment';
import { effectiveSelections, ruleViolations } from '@/modules/catalog/structure';
import { countryInput } from './supplier-repository';
import { getDatabase } from './client';
import {
  columns,
  current,
  dto,
  insert,
  invalid,
  missing,
  mutate,
  update,
  type Row,
} from './admin-mutations';
import { writeAudit } from './audit';
import { workingCatalog } from './catalog-working';
import { getCurrentVersion, getRelease } from './release-repository';
export async function commerceSettings(): Promise<Row & { confirmed: boolean }> {
  const [row] = await (
    await getDatabase()
  ).query("SELECT * FROM commerce_settings WHERE id='default'");
  return { ...dto(row), confirmed: !!row.updated_by };
}
const commerceInput = z.strictObject({
  rowVersion: rowVersionInput,
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  shippingFlatMinor: moneyInput.optional(),
  shipCountries: z.array(countryInput).min(1).max(250).optional(),
  quoteTtlMinutes: z.number().int().min(60).max(43200).optional(),
  orderNumberPrefix: z
    .string()
    .regex(/^[A-Z]{2,4}$/)
    .optional(),
  opsTimezone: z
    .string()
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, 'Choose an IANA timezone.')
    .optional(),
});
export const saveCommerce = (
  input: unknown,
  actor: string,
): Promise<Row & { confirmed: boolean }> => {
  const { rowVersion, ...data } = commerceInput.parse(input);
  return mutate(async (q) => {
    const old = await current(q, 'commerce_settings', 'default');
    if (data.currency && data.currency !== old.currency) {
      const [schema] = await q("SELECT to_regclass('public.orders') AS orders");
      const [orders] = schema.orders
        ? await q('SELECT count(*)::int AS count FROM orders')
        : [{ count: 0 }];
      if (Number(orders.count) > 0) {
        const { DomainError } = await import('@/modules/configuration/types');
        throw new DomainError('currency_locked', 'Currency is locked after the first order.', 409);
      }
    }
    const row = await update(
      q,
      'commerce_settings',
      'default',
      { ...columns(data), updated_by: actor },
      rowVersion,
      actor,
    );
    return { ...dto(row), confirmed: true };
  });
};
export async function pricingMatrix() {
  const db = await getDatabase();
  const [commerce] = await db.query("SELECT currency FROM commerce_settings WHERE id='default'");
  const bands = await db.query(
    'SELECT b.*,count(m.id)::int AS material_count FROM price_bands b LEFT JOIN materials m ON m.price_band_code=b.code GROUP BY b.code ORDER BY b.sort,b.code',
  );
  const products = await db.query(
    'SELECT id,code,name,base_price_minor FROM products ORDER BY sort,code',
  );
  const prices = await db.query('SELECT * FROM product_band_prices');
  return {
    currency: commerce.currency,
    bands: bands.map(dto),
    matrix: products.map((p) => ({
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      basePriceMinor: p.base_price_minor,
      // The price per tier as a release will compute it (PRC-002, D-022).
      prices: Object.fromEntries(
        bands.map((b) => [
          b.code,
          p.base_price_minor !== null
            ? Number(p.base_price_minor) + Number(b.uplift_minor)
            : (prices.find((v) => v.product_id === p.id && v.band_code === b.code)?.price_minor ??
              null),
        ]),
      ),
    })),
  };
}
const bandsInput = z.strictObject({
  items: z
    .array(
      z.strictObject({
        code: z.string().regex(/^[A-Z0-9]{1,8}$/),
        name: z.string().trim().min(1).max(200),
        description: z.string().max(2000).optional(),
        sort: z.number().int().optional(),
        upliftMinor: moneyInput.optional(),
      }),
    )
    .max(100),
});
export const saveBands = (input: unknown, actor: string) => {
  const { items } = bandsInput.parse(input);
  if (new Set(items.map((i) => i.code)).size !== items.length)
    invalid('Band codes must be unique.');
  return mutate(async (q) => {
    const rows = await q('SELECT * FROM price_bands FOR UPDATE');
    for (const old of rows)
      if (!items.some((i) => i.code === old.code))
        await q('DELETE FROM price_bands WHERE code=$1', [old.code]);
    for (const item of items) {
      const old = rows.find((r) => r.code === item.code);
      if (old)
        await update(q, 'price_bands', item.code, columns(item), old.row_version, actor, 'code');
      else await insert(q, 'price_bands', columns(item), actor);
    }
    await writeAudit(q, {
      actor,
      action: 'price_bands.saved',
      entityType: 'price_bands',
      summary: { fields: ['bands'] },
    });
    return { items };
  });
};
export const saveBandPrices = (id: string, input: unknown, actor: string) => {
  const { items } = z
    .strictObject({
      items: z
        .array(
          z.strictObject({
            bandCode: z.string().regex(/^[A-Z0-9]{1,8}$/),
            priceMinor: moneyInput.nullable(),
          }),
        )
        .max(100),
    })
    .parse(input);
  if (new Set(items.map((i) => i.bandCode)).size !== items.length) invalid('Use each band once.');
  return mutate(async (q) => {
    await current(q, 'products', id);
    for (const item of items) {
      if (item.priceMinor === null)
        await q('DELETE FROM product_band_prices WHERE product_id=$1 AND band_code=$2', [
          id,
          item.bandCode,
        ]);
      else
        await q(
          'INSERT INTO product_band_prices(product_id,band_code,price_minor) VALUES($1,$2,$3) ON CONFLICT(product_id,band_code) DO UPDATE SET price_minor=excluded.price_minor,row_version=product_band_prices.row_version+1,updated_at=now()',
          [id, item.bandCode, item.priceMinor],
        );
    }
    await writeAudit(q, {
      actor,
      action: 'product_band_prices.saved',
      entityType: 'products',
      entityId: id,
      summary: { fields: ['bandPrices'] },
    });
    return { items };
  });
};
export const simulationInput = z.strictObject({
  source: z.enum(['working', 'current']),
  productCode: codeSchema,
  materialCode: codeSchema.optional(),
  includedComponents: z.array(codeSchema).max(20).optional(),
  selections: z.record(codeSchema, z.string().max(200)).optional(),
  quantity: z.number().int().min(1).max(5).optional(),
});
export async function simulation(input: unknown) {
  const data = simulationInput.parse(input);
  const version = data.source === 'current' ? await getCurrentVersion() : null;
  const index =
    data.source === 'working'
      ? (await workingCatalog()).index
      : version
        ? (await getRelease(version.version))!.index
        : missing();
  const base = newGarment(index, data.productCode, 'simulation');
  const garment = {
    ...base,
    materialCode: data.materialCode ?? base.materialCode,
    includedComponents: data.includedComponents ?? base.includedComponents,
    selections: { ...base.selections, ...data.selections },
    quantity: data.quantity ?? 1,
  };
  const effective = effectiveSelections(index, garment);
  const violations = ruleViolations(index, effective);
  let impactPreview: unknown[] = [];
  try {
    impactPreview = applyGarmentPatch(index, garment, {}, { confirmImpact: true }).impact;
  } catch {
    /* The exact violations remain visible when no valid resolution exists. */
  }
  return {
    quote: quoteGarment(index, garment),
    violations,
    visible: { groups: [...effective.visibleGroups], attributes: [...effective.visibleAttributes] },
    impactPreview,
  };
}
