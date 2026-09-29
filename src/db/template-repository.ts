import { z } from 'zod';
import { codeSchema, TEMPLATE_CODE } from '@/modules/catalog/snapshot';
import { idInput, rowVersionInput, statusInput } from '@/modules/catalog/admin-input';
import { newGarment, validateGarment } from '@/modules/catalog/garment';
import { quoteGarment } from '@/modules/pricing/quote';
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
import { workingCatalog, badgesFor } from './catalog-working';
import { writeAudit } from './audit';
import { getDraft } from './repository';
export const templateInput = z.strictObject({
  code: z.string().max(180).regex(TEMPLATE_CODE),
  productId: idInput,
  materialId: idInput,
  name: z.string().trim().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  story: z.string().max(2000).optional(),
  includedComponents: z.array(codeSchema).max(20).optional(),
  selections: z.record(codeSchema, z.string().max(200)).optional(),
  occasionCodes: z.array(codeSchema).max(100).optional(),
  climateCodes: z.array(codeSchema).max(100).optional(),
  featured: z.boolean().optional(),
  sort: z.number().int().optional(),
  status: statusInput.optional(),
});
export async function templateFromPreview(userId: string, input: unknown) {
  const data = z
    .strictObject({
      garmentId: z.uuid(),
      code: templateInput.shape.code,
      name: templateInput.shape.name,
    })
    .parse(input);
  const draft = await getDraft(`preview:user:${userId}`);
  const garment = draft.garments.find((g) => g.id === data.garmentId) ?? missing();
  const db = await getDatabase();
  const [product] = await db.query('SELECT id FROM products WHERE code=$1', [garment.productCode]);
  const [material] = await db.query('SELECT id FROM materials WHERE code=$1', [
    garment.materialCode,
  ]);
  if (!product || !material) missing();
  return saveTemplate(
    null,
    {
      code: data.code,
      name: data.name,
      productId: product.id,
      materialId: material.id,
      includedComponents: garment.includedComponents,
      selections: garment.selections,
      status: 'draft',
    },
    `user:${userId}`,
  );
}
export async function templateDetail(id: string, query?: Query): Promise<Row> {
  const q = query ?? (await getDatabase()).query;
  const [row] = await q('SELECT * FROM templates WHERE id=$1', [id]);
  if (!row) missing();
  const media = await q(
    'SELECT tm.*,ma.alt_text FROM template_media tm JOIN media_assets ma ON ma.id=tm.media_id WHERE template_id=$1 ORDER BY tm.sort,tm.media_id',
    [id],
  );
  const working = await workingCatalog(q);
  const product = working.rows.products.find((p) => p.id === row.product_id);
  const material = working.rows.materials.find((m) => m.id === row.material_id);
  let resolved = null,
    quote = null,
    violations: unknown[] = [];
  if (product && working.index.products.has(product.code)) {
    const base = newGarment(working.index, product.code, 'template-preview');
    const garment = {
      ...base,
      materialCode: material?.code ?? '',
      includedComponents: row.included_components as string[],
      selections: { ...base.selections, ...(row.selections as Record<string, string>) },
    };
    resolved = garment;
    quote = quoteGarment(working.index, garment);
    violations = validateGarment(working.index, garment).issues;
  }
  return {
    ...dto(row),
    media: media.map((m) => ({ ...dto(m), url: `/api/media/${m.media_id}` })),
    heroUrl: media.find((m) => m.role === 'hero')
      ? `/api/media/${media.find((m) => m.role === 'hero')!.media_id}`
      : null,
    resolved,
    quote,
    workingPriceMinor: quote?.status === 'priced' ? quote.unitMinor : null,
    violations,
    badges: badgesFor(working.report, 'template', String(row.code)),
  };
}
export async function listTemplates(input: unknown) {
  const filter = z
    .object({ productId: idInput.optional(), status: statusInput.optional() })
    .parse(input);
  const rows = await (
    await getDatabase()
  ).query(
    'SELECT id FROM templates WHERE ($1::text IS NULL OR product_id=$1) AND ($2::text IS NULL OR status=$2) ORDER BY featured DESC,sort,code',
    [filter.productId ?? null, filter.status ?? null],
  );
  const items = [];
  for (const row of rows) items.push(await templateDetail(String(row.id)));
  return { items };
}
export const saveTemplate = (id: string | null, input: unknown, actor: string) => {
  const data: Row = id
    ? templateInput.partial().extend({ rowVersion: rowVersionInput }).parse(input)
    : templateInput.parse(input);
  const { rowVersion, ...fields } = data;
  return mutate(async (q) => {
    const old = id ? await current(q, 'templates', id) : {};
    const merged = { ...old, ...columns(fields) };
    const product = await current(q, 'products', String(merged.product_id));
    await current(q, 'materials', String(merged.material_id));
    const parts = await q(
      'SELECT c.code FROM product_components pc JOIN components c ON c.id=pc.component_id WHERE pc.product_id=$1',
      [product.id],
    );
    for (const code of (merged.included_components as string[]) ?? [])
      if (!parts.some((p) => p.code === code))
        invalid('Choose parts belonging to this product.', 'includedComponents');
    for (const [field, type] of [
      ['occasion_codes', 'occasion'],
      ['climate_codes', 'climate'],
    ])
      for (const code of (merged[field] as string[]) ?? [])
        if (
          !(await q('SELECT id FROM lookup_values WHERE type_code=$1 AND code=$2', [type, code]))
            .length
        )
          invalid('Choose an existing list value.', field);
    const row = id
      ? await update(q, 'templates', id, columns(fields), rowVersion, actor)
      : await insert(q, 'templates', { id: crypto.randomUUID(), ...columns(fields) }, actor);
    return templateDetail(String(row.id), q);
  });
};
export const setTemplateMedia = (id: string, input: unknown, actor: string) => {
  const { items } = z
    .strictObject({
      items: z
        .array(
          z.strictObject({
            mediaId: idInput,
            role: z.enum(['hero', 'gallery']),
            sort: z.number().int(),
          }),
        )
        .min(1)
        .max(9),
    })
    .parse(input);
  if (
    items.filter((i) => i.role === 'hero').length !== 1 ||
    new Set(items.map((i) => i.mediaId)).size !== items.length
  )
    invalid('Choose exactly one hero image and up to eight distinct gallery images.');
  return mutate(async (q) => {
    await current(q, 'templates', id);
    await q('DELETE FROM template_media WHERE template_id=$1', [id]);
    for (const item of items)
      await q('INSERT INTO template_media(template_id,media_id,role,sort) VALUES($1,$2,$3,$4)', [
        id,
        item.mediaId,
        item.role,
        item.sort,
      ]);
    await writeAudit(q, {
      actor,
      action: 'template_media.saved',
      entityType: 'templates',
      entityId: id,
      summary: { fields: ['media'] },
    });
    return { items };
  });
};
export const duplicateTemplate = (id: string, input: unknown, actor: string) => {
  const { newCode, newName } = z
    .strictObject({ newCode: templateInput.shape.code, newName: templateInput.shape.name })
    .parse(input);
  return mutate(async (q) => {
    const old = await current(q, 'templates', id);
    const fields = Object.fromEntries(
      Object.entries(old).filter(
        ([key]) =>
          !['id', 'created_at', 'updated_at', 'row_version', 'first_published_version'].includes(
            key,
          ),
      ),
    );
    const row = await insert(
      q,
      'templates',
      { ...fields, id: crypto.randomUUID(), code: newCode, name: newName, status: 'draft' },
      actor,
    );
    await q(
      'INSERT INTO template_media(template_id,media_id,role,sort) SELECT $1,media_id,role,sort FROM template_media WHERE template_id=$2',
      [row.id, id],
    );
    return templateDetail(String(row.id), q);
  });
};
