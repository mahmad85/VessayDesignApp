import { z } from 'zod';
import { codeSchema } from '@/modules/catalog/snapshot';
import type { LookupMetadataField } from '@/modules/catalog/lookup-seeds';
import { getDatabase, type Query } from './client';
import { columns, current, dto, insert, invalid, missing, mutate, update } from './admin-mutations';
import { writeAudit } from './audit';
const fields = z
  .object({
    code: codeSchema,
    label: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    metadata: z
      .record(z.string().max(80), z.union([z.string().max(2000), z.number().finite(), z.boolean()]))
      .optional(),
  })
  .strict();
async function validate(query: Query, typeCode: string, metadata: Record<string, unknown>) {
  const [type] = await query('SELECT * FROM lookup_types WHERE code=$1', [typeCode]);
  if (!type) missing();
  for (const field of type.value_metadata_schema as LookupMetadataField[]) {
    const value = metadata[field.key];
    if (
      (field.required && (value === undefined || value === '')) ||
      (value !== undefined &&
        (typeof value !== 'string' || (field.allowed && !field.allowed.includes(value))))
    )
      invalid(`Provide a valid ${field.label}.`, 'metadata.' + field.key);
    if (field.key === 'hex' && typeof value === 'string' && !/^#[0-9a-fA-F]{6}$/.test(value))
      invalid('Use a six-digit hex colour.', 'metadata.hex');
  }
}
export async function getLookups() {
  const db = await getDatabase();
  const types = await db.query('SELECT * FROM lookup_types ORDER BY label');
  const values = await db.query('SELECT * FROM lookup_values ORDER BY sort,label,id');
  return {
    types: types.map((t) => ({
      ...dto(t),
      code: String(t.code),
      system: t.system === true,
      values: values.filter((v) => v.type_code === t.code).map(dto),
    })),
  };
}
export async function addLookup(typeCode: string, input: unknown, actor: string) {
  const data = fields.parse(input);
  return mutate(async (q) => {
    await validate(q, typeCode, data.metadata ?? {});
    return dto(
      await insert(
        q,
        'lookup_values',
        { id: crypto.randomUUID(), type_code: typeCode, ...columns(data) },
        actor,
      ),
    );
  });
}
export async function editLookup(id: string, input: unknown, actor: string) {
  const { rowVersion, ...data } = fields
    .omit({ code: true })
    .partial()
    .extend({ active: z.boolean().optional(), rowVersion: z.number().int().positive() })
    .parse(input);
  return mutate(async (q) => {
    const row = await current(q, 'lookup_values', id);
    await validate(
      q,
      String(row.type_code),
      data.metadata ?? (row.metadata as Record<string, unknown>),
    );
    return dto(await update(q, 'lookup_values', id, columns(data), rowVersion, actor));
  });
}
export async function orderLookups(typeCode: string, input: unknown, actor: string) {
  const data = z
    .object({ orderedIds: z.array(z.string().min(1)).max(1000) })
    .strict()
    .parse(input);
  return mutate(async (q) => {
    const rows = await q('SELECT id FROM lookup_values WHERE type_code=$1 FOR UPDATE', [typeCode]);
    if (
      new Set(data.orderedIds).size !== rows.length ||
      rows.length !== data.orderedIds.length ||
      rows.some((r) => !data.orderedIds.includes(String(r.id)))
    )
      invalid('Include each value in this list exactly once.');
    for (const [i, id] of data.orderedIds.entries())
      await q(
        'UPDATE lookup_values SET sort=$1,row_version=row_version+1,updated_at=now() WHERE id=$2',
        [i * 10, id],
      );
    await writeAudit(q, {
      actor,
      action: 'lookup_values.reorder',
      entityType: 'lookup_types',
      entityId: typeCode,
      summary: { fields: ['sort'] },
    });
    return { ok: true };
  });
}
