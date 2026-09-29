import { DomainError } from '@/modules/configuration/types';
import { writeAudit } from './audit';
import { getDatabase, type Query } from './client';
export type Row = Record<string, unknown>;
export const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
export const snake = (key: string) => key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
export const dto = (row: Row) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [camel(k), v]));
export const jsonColumns = new Set([
  'metadata',
  'visible_when',
  'text_rules',
  'metadata_fields',
  'when_condition',
  'composition',
  'selections',
  'value_metadata_schema',
]);
export const param = (key: string, value: unknown) =>
  jsonColumns.has(key) && value !== null ? JSON.stringify(value) : value;
export function missing(): never {
  throw new DomainError('not_found', 'That record does not exist.', 404);
}
export function invalid(message: string, path?: string): never {
  throw new DomainError(
    'validation_failed',
    message,
    422,
    path ? { fields: [{ path, message }] } : undefined,
  );
}
export async function current(query: Query, table: string, id: string, key = 'id') {
  const [row] = await query(`SELECT * FROM ${table} WHERE ${key}=$1 FOR UPDATE`, [id]);
  return row ?? missing();
}
export function version(row: Row, expected: unknown) {
  if (row.row_version !== expected)
    throw new DomainError(
      'stale_row_version',
      'Someone else changed this — review their version.',
      409,
      { current: dto(row) },
    );
}
// Only trusted repository code supplies identifiers; client input is always a parameter.
export async function insert(query: Query, table: string, data: Row, actor: string) {
  const fields = Object.keys(data);
  const [row] = await query(
    `INSERT INTO ${table}(${fields.join(',')}) VALUES(${fields.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
    fields.map((k) => param(k, data[k])),
  );
  await writeAudit(query, {
    actor,
    action: `${table}.create`,
    entityType: table,
    entityId: String(row.id ?? row.code),
    summary: { fields: fields.filter((f) => f !== 'id') },
  });
  return row;
}
export async function update(
  query: Query,
  table: string,
  id: string,
  input: Row,
  expected: unknown,
  actor: string,
  key = 'id',
) {
  const old = await current(query, table, id, key);
  version(old, expected);
  if (input.code !== undefined && input.code !== old.code && old.first_published_version)
    throw new DomainError(
      'code_immutable',
      'This code is locked because it has been published.',
      409,
    );
  const fields = Object.keys(input);
  if (!fields.length) return old;
  const [row] = await query(
    `UPDATE ${table} SET ${fields.map((k, i) => `${k}=$${i + 1}`).join(',')},row_version=row_version+1,updated_at=now() WHERE ${key}=$${fields.length + 1} RETURNING *`,
    [...fields.map((k) => param(k, input[k])), id],
  );
  await writeAudit(query, {
    actor,
    action: `${table}.update`,
    entityType: table,
    entityId: id,
    summary: { fields },
  });
  return row;
}
export const columns = (data: Row) =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [snake(k), v]),
  );
export async function mutate<T>(run: (query: Query) => Promise<T>) {
  try {
    return await (
      await getDatabase()
    ).transaction(async (query) => {
      // A publish must see one complete working copy, including multi-row edits.
      await query('SELECT pg_advisory_xact_lock(731851)');
      return run(query);
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === '23505')
      throw new DomainError('code_taken', 'That code or link already exists.', 409);
    if (code === '23503')
      throw new DomainError(
        'entity_in_use',
        'This record is referenced, or a linked record no longer exists.',
        409,
      );
    if (code === '23514' || code === '23502')
      invalid('The record does not meet its field requirements.');
    throw e;
  }
}
