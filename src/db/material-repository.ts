import { z } from 'zod';
import {
  materialInput,
  availabilityInput,
  materialMediaInput,
  overridesInput,
  bulkMaterialsInput,
  REFERENCE_CONFIRMATION,
} from '@/modules/catalog/material-input';
import { duplicateInput, rowVersionInput } from '@/modules/catalog/admin-input';
import { pageQuery } from '@/lib/admin-http';
import { DomainError } from '@/modules/configuration/types';
import { getDatabase, type Query } from './client';
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
import { bustAvailabilityCache } from './availability';
import { workingCatalog, badgesFor } from './catalog-working';
import { structureTables } from './catalog-structure-repository';
const lookupFields: Record<string, string> = {
  colour_family_code: 'colour_family',
  pattern_code: 'pattern',
  weave_code: 'weave',
  texture_code: 'texture',
  sheen_code: 'sheen',
  finish_codes: 'finish',
  stretch_code: 'stretch',
  season_codes: 'season',
  climate_codes: 'climate',
  occasion_codes: 'occasion',
  care_codes: 'care',
  tag_codes: 'tag',
};
export async function validateMaterial(query: Query, row: Row, old: Row = {}) {
  const lookups = await query('SELECT type_code,code FROM lookup_values');
  const check = (type: string, code: unknown, field: string) => {
    if (code && !lookups.some((l) => l.type_code === type && l.code === code))
      invalid(`Unknown ${type} value.`, field);
  };
  for (const [key, type] of Object.entries(lookupFields))
    for (const value of Array.isArray(row[key]) ? (row[key] as unknown[]) : [row[key]])
      check(type, value, key);
  const composition = (row.composition ?? []) as { fibre: string; percent: number }[];
  if (new Set(composition.map((c) => c.fibre)).size !== composition.length)
    invalid('List each fibre once.', 'composition');
  for (const item of composition) check('fibre', item.fibre, 'composition');
  if (row.super_number && !composition.some((c) => c.fibre === 'wool'))
    invalid('A Super number applies only to wool.', 'superNumber');
  if (row.supplier_id) {
    const supplier = await current(query, 'suppliers', String(row.supplier_id));
    if (!['fabric_mill', 'fabric_merchant'].includes(String(supplier.kind)))
      invalid('Choose a fabric mill or merchant.', 'supplierId');
    if (old.supplier_id !== row.supplier_id && supplier.status !== 'active')
      throw new DomainError('supplier_inactive', 'Choose an active supplier.', 409);
  }
}
export async function materialDetail(id: string, query?: Query): Promise<Row> {
  const q = query ?? (await getDatabase()).query;
  const [row] = await q('SELECT * FROM materials WHERE id=$1', [id]);
  if (!row) missing();
  const [supplier] = row.supplier_id
    ? await q('SELECT id,name FROM suppliers WHERE id=$1', [row.supplier_id])
    : [];
  return {
    ...dto(row),
    productIds: (
      await q('SELECT product_id FROM material_products WHERE material_id=$1 ORDER BY product_id', [
        id,
      ])
    ).map((r) => r.product_id),
    media: (
      await q(
        'SELECT mm.*,ma.alt_text,ma.rights_status FROM material_media mm JOIN media_assets ma ON ma.id=mm.media_id WHERE mm.material_id=$1 ORDER BY mm.sort,mm.media_id',
        [id],
      )
    ).map((r) => ({ ...dto(r), url: `/api/media/${r.media_id}` })),
    priceOverrides: (
      await q('SELECT * FROM material_price_overrides WHERE material_id=$1', [id])
    ).map(dto),
    supplier: supplier ?? null,
  };
}
export async function listMaterials(input: unknown) {
  const f = pageQuery
    .extend({
      query: z.string().max(200).optional(),
      status: materialInput.shape.status,
      usage: z.string().optional(),
      productId: z.string().optional(),
      band: z.string().optional(),
      availability: availabilityInput.shape.availability.optional(),
      supplierId: z.string().optional(),
      referenceOnly: z.enum(['true', 'false']).optional(),
    })
    .parse(input);
  const db = await getDatabase();
  const rows = await db.query(
    'SELECT m.*,s.name AS supplier_name FROM materials m LEFT JOIN suppliers s ON s.id=m.supplier_id WHERE ($1::text IS NULL OR m.name ILIKE $1 OR m.code ILIKE $1) AND ($2::text IS NULL OR m.status=$2) AND ($3::text IS NULL OR $3=ANY(m.usages)) AND ($4::text IS NULL OR EXISTS(SELECT 1 FROM material_products mp WHERE mp.material_id=m.id AND mp.product_id=$4)) AND ($5::text IS NULL OR m.price_band_code=$5) AND ($6::text IS NULL OR m.availability=$6) AND ($7::text IS NULL OR m.supplier_id=$7) AND ($8::boolean IS NULL OR m.reference_only=$8) AND ($9::text IS NULL OR m.id>$9) ORDER BY m.id LIMIT $10',
    [
      f.query ? `%${f.query}%` : null,
      f.status ?? null,
      f.usage ?? null,
      f.productId ?? null,
      f.band ?? null,
      f.availability ?? null,
      f.supplierId ?? null,
      f.referenceOnly === undefined ? null : f.referenceOnly === 'true',
      f.cursor ?? null,
      f.limit + 1,
    ],
  );
  const { report } = await workingCatalog();
  const links = await db.query(
    'SELECT mp.material_id,p.code FROM material_products mp JOIN products p ON p.id=mp.product_id',
  );
  const media = await db.query(
    "SELECT material_id,media_id FROM material_media WHERE role='swatch' ORDER BY sort,media_id",
  );
  return {
    items: rows.slice(0, f.limit).map((r) => ({
      ...dto(r),
      swatchUrl: media.find((m) => m.material_id === r.id)
        ? `/api/media/${media.find((m) => m.material_id === r.id)!.media_id}`
        : null,
      productCodes: links.filter((l) => l.material_id === r.id).map((l) => l.code),
      badges: badgesFor(report, 'material', String(r.code)),
    })),
    nextCursor: rows.length > f.limit ? String(rows[f.limit - 1].id) : null,
  };
}
export async function saveMaterial(id: string | null, input: unknown, actor: string): Promise<Row> {
  const data: Row = id
    ? materialInput.partial().extend({ rowVersion: rowVersionInput }).parse(input)
    : materialInput.parse(input);
  const { productIds, rowVersion, ...fields } = data;
  return mutate(async (q) => {
    const old = id ? await current(q, 'materials', id) : {};
    await validateMaterial(q, { ...old, ...columns(fields) }, old);
    const merged = { ...old, ...columns(fields) };
    const products =
      productIds ??
      (id
        ? (await q('SELECT product_id FROM material_products WHERE material_id=$1', [id])).map(
            (r) => r.product_id,
          )
        : []);
    const swatch =
      id &&
      (
        await q(
          "SELECT media_id FROM material_media WHERE material_id=$1 AND role='swatch' LIMIT 1",
          [id],
        )
      ).length;
    const activationMissing = [
      !merged.name && 'name',
      !merged.primary_hex && 'primary colour',
      !merged.pattern_code && 'pattern',
      !((merged.usages as string[]) ?? []).length && 'usage',
      !(products as string[]).length && 'allowed product',
      !swatch && 'swatch image',
    ].filter(Boolean) as string[];
    if (merged.status === 'active' && activationMissing.length) fields.status = 'draft';
    const row = id
      ? await update(q, 'materials', id, columns(fields), rowVersion, actor)
      : await insert(q, 'materials', { id: crypto.randomUUID(), ...columns(fields) }, actor);
    if (productIds !== undefined) {
      if (new Set(productIds as string[]).size !== (productIds as string[]).length)
        invalid('Choose each product once.', 'productIds');
      await q('DELETE FROM material_products WHERE material_id=$1', [row.id]);
      for (const productId of productIds as string[])
        await q('INSERT INTO material_products(material_id,product_id) VALUES($1,$2)', [
          row.id,
          productId,
        ]);
      await writeAudit(q, {
        actor,
        action: 'material_products.saved',
        entityType: 'materials',
        entityId: String(row.id),
        summary: { fields: ['productIds'] },
      });
    }
    return {
      ...(await materialDetail(String(row.id), q)),
      ...(merged.status === 'active' && activationMissing.length ? { activationMissing } : {}),
    };
  });
}
export async function setAvailability(id: string, input: unknown, actor: string) {
  const { rowVersion, ...data } = availabilityInput.parse(input);
  const result = await mutate(async (q) => {
    await update(
      q,
      'materials',
      id,
      { ...columns(data), availability_updated_at: new Date() },
      rowVersion,
      actor,
    );
    return materialDetail(id, q);
  });
  bustAvailabilityCache();
  return result;
}
export const setMaterialMedia = (id: string, input: unknown, actor: string) => {
  const { items } = materialMediaInput.parse(input);
  return mutate(async (q) => {
    await current(q, 'materials', id);
    if (new Set(items.map((i) => i.mediaId)).size !== items.length)
      invalid('Use an image only once.');
    await q('DELETE FROM material_media WHERE material_id=$1', [id]);
    for (const item of items)
      await q('INSERT INTO material_media(material_id,media_id,role,sort) VALUES($1,$2,$3,$4)', [
        id,
        item.mediaId,
        item.role,
        item.sort,
      ]);
    await writeAudit(q, {
      actor,
      action: 'material_media.saved',
      entityType: 'materials',
      entityId: id,
      summary: { fields: ['media'] },
    });
    return { items };
  });
};
export const setMaterialOverrides = (id: string, input: unknown, actor: string) => {
  const { items } = overridesInput.parse(input);
  return mutate(async (q) => {
    await current(q, 'materials', id);
    if (new Set(items.map((i) => i.productId)).size !== items.length)
      invalid('Use a product only once.');
    for (const item of items) {
      if (
        !(
          await q(
            'SELECT product_id FROM material_products WHERE material_id=$1 AND product_id=$2',
            [id, item.productId],
          )
        ).length
      )
        invalid('Link this fabric to the product before pricing it.');
      if (item.priceMinor === null)
        await q('DELETE FROM material_price_overrides WHERE material_id=$1 AND product_id=$2', [
          id,
          item.productId,
        ]);
      else
        await q(
          'INSERT INTO material_price_overrides(material_id,product_id,price_minor) VALUES($1,$2,$3) ON CONFLICT(material_id,product_id) DO UPDATE SET price_minor=excluded.price_minor,row_version=material_price_overrides.row_version+1,updated_at=now()',
          [id, item.productId, item.priceMinor],
        );
    }
    await writeAudit(q, {
      actor,
      action: 'material_prices.saved',
      entityType: 'materials',
      entityId: id,
      summary: { fields: ['priceOverrides'] },
    });
    return { items };
  });
};
export async function bulkMaterials(input: unknown, actor: string) {
  const { ids, set } = bulkMaterialsInput.parse(input);
  if (new Set(ids).size !== ids.length) invalid('Choose each fabric once.');
  const result = await mutate(async (q) => {
    for (const id of ids) {
      const row = await current(q, 'materials', id);
      await update(
        q,
        'materials',
        id,
        { ...columns(set), ...(set.availability ? { availability_updated_at: new Date() } : {}) },
        row.row_version,
        actor,
      );
    }
    return { updated: ids.length };
  });
  if (set.availability) bustAvailabilityCache();
  return result;
}
export const duplicateMaterial = (id: string, input: unknown, actor: string) => {
  const { newCode, newName } = duplicateInput.parse(input);
  return mutate(async (q) => {
    const row = await current(q, 'materials', id);
    const fields = Object.fromEntries(
      Object.entries(row).filter(
        ([key]) =>
          ![
            'id',
            'created_at',
            'updated_at',
            'row_version',
            'first_published_version',
            'availability',
            'availability_updated_at',
            'stock_meters',
            'lead_time_days',
          ].includes(key),
      ),
    );
    const next = await insert(
      q,
      'materials',
      { ...fields, id: crypto.randomUUID(), code: newCode, name: newName, status: 'draft' },
      actor,
    );
    for (const [table, cols] of [
      ['material_products', 'product_id'],
      ['material_media', 'media_id,role,sort'],
      ['material_price_overrides', 'product_id,price_minor'],
    ])
      await q(
        `INSERT INTO ${table}(material_id,${cols}) SELECT $1,${cols} FROM ${table} WHERE material_id=$2`,
        [next.id, id],
      );
    return materialDetail(String(next.id), q);
  });
};
export const clearReference = (entity: string, id: string, input: unknown, actor: string) => {
  z.strictObject({ confirmation: z.literal(REFERENCE_CONFIRMATION) }).parse(input);
  const tables = { ...structureTables, materials: 'materials', templates: 'templates' };
  if (!Object.hasOwn(tables, entity) || entity === 'rules') missing();
  return mutate(async (q) => {
    const table = tables[entity as keyof typeof tables];
    const row = await current(q, table, id);
    await update(q, table, id, { reference_only: false }, row.row_version, actor);
    await writeAudit(q, {
      actor,
      action: 'reference_only.cleared',
      entityType: table,
      entityId: id,
      summary: { fields: ['referenceOnly'] },
    });
    return dto({ ...row, reference_only: false, row_version: Number(row.row_version) + 1 });
  });
};
