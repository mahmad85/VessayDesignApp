import { z } from 'zod';
import { codeSchema } from '@/modules/catalog/snapshot';
import { rowVersionInput } from '@/modules/catalog/admin-input';
import { DomainError } from '@/modules/configuration/types';
import { pageQuery } from '@/lib/admin-http';
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
import { currentItemsClause } from './fulfillment-repository';
import { opsToday } from '@/modules/orders/fulfillment';
async function supplierCounts(q: Query, id: string) {
  const [c] = await q('SELECT ops_timezone FROM commerce_settings LIMIT 1');
  const [counts] = await q(
    `SELECT count(*) FILTER(WHERE i.fulfillment_status NOT IN ('delivered','completed','cancelled'))::int AS open_items,count(*) FILTER(WHERE i.fulfillment_status IN ('released','in_production','quality_check') AND i.supplier_due_date<$2::date)::int AS overdue_items FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.supplier_id=$1 AND ${currentItemsClause}`,
    [id, opsToday(String(c?.ops_timezone ?? 'UTC'))],
  );
  return { openItems: Number(counts.open_items), overdueItems: Number(counts.overdue_items) };
}
export const COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );
export const countryInput = z
  .string()
  .refine((v) => COUNTRY_CODES.includes(v), 'Choose an ISO country code.');
const optionalText = (max = 200) => z.string().max(max).optional();
export const contactInput = z.strictObject({
  name: z.string().trim().min(1).max(200),
  roleTitle: optionalText(),
  email: z.email().max(254).optional(),
  phone: z
    .string()
    .regex(/^[+0-9 ()-]{7,20}$/)
    .optional(),
  preferredChannel: z.enum(['email', 'phone']).optional(),
  notes: optionalText(2000),
});
export const supplierInput = z.strictObject({
  code: codeSchema,
  name: z.string().trim().min(1).max(200),
  legalName: optionalText(),
  kind: z.enum(['fabric_mill', 'fabric_merchant', 'manufacturer', 'accessory', 'other']),
  status: z.enum(['active', 'inactive']).optional(),
  website: z
    .url()
    .refine((v) => /^https?:\/\//.test(v), 'Use an http or https URL.')
    .optional(),
  addressLine1: optionalText(),
  addressLine2: optionalText(),
  city: optionalText(),
  region: optionalText(),
  postalCode: optionalText(40),
  countryCode: countryInput.optional(),
  defaultLeadTimeDays: z.number().int().min(0).max(365).optional(),
  capabilities: z.array(codeSchema).max(100).optional(),
  notes: optionalText(2000),
  primaryContact: contactInput.optional(),
  secondaryContact: contactInput.optional(),
});
async function validateSupplier(query: Query, row: Row, primary: unknown) {
  if (
    (row.status ?? 'active') === 'active' &&
    (!String(row.address_line1 ?? '').trim() ||
      !String(row.city ?? '').trim() ||
      !row.country_code ||
      !primary)
  )
    invalid('Active suppliers need an address, city, country and primary contact.');
  for (const code of (row.capabilities ?? []) as string[])
    if (!(await query('SELECT id FROM products WHERE code=$1', [code])).length)
      invalid('Choose existing products for capabilities.', 'capabilities');
}
async function saveContact(
  query: Query,
  supplierId: string,
  rank: string,
  data: z.infer<typeof contactInput>,
  actor: string,
  expected?: number,
) {
  if (data.preferredChannel && !data[data.preferredChannel])
    invalid('Provide the preferred contact method.', 'preferredChannel');
  const [old] = await query(
    'SELECT * FROM supplier_contacts WHERE supplier_id=$1 AND rank=$2 FOR UPDATE',
    [supplierId, rank],
  );
  if (old)
    return dto(
      await update(
        query,
        'supplier_contacts',
        String(old.id),
        columns(data),
        expected ?? old.row_version,
        actor,
      ),
    );
  if (expected !== undefined)
    throw new DomainError('stale_row_version', 'This contact no longer exists.', 409, {
      current: null,
    });
  return dto(
    await insert(
      query,
      'supplier_contacts',
      { id: crypto.randomUUID(), supplier_id: supplierId, rank, ...columns(data) },
      actor,
    ),
  );
}
export async function supplierDetail(id: string, query?: Query): Promise<Row> {
  const q = query ?? (await getDatabase()).query;
  const [row] = await q('SELECT * FROM suppliers WHERE id=$1', [id]);
  if (!row) missing();
  const contacts = await q('SELECT * FROM supplier_contacts WHERE supplier_id=$1', [id]);
  return {
    ...dto(row),
    ...(await supplierCounts(q, id)),
    contacts: {
      primary: contacts.find((c) => c.rank === 'primary')
        ? dto(contacts.find((c) => c.rank === 'primary')!)
        : null,
      secondary: contacts.find((c) => c.rank === 'secondary')
        ? dto(contacts.find((c) => c.rank === 'secondary')!)
        : null,
    },
    materials: (
      await q('SELECT id,code,name,status FROM materials WHERE supplier_id=$1 ORDER BY name', [id])
    ).map(dto),
  };
}
export async function listSuppliers(input: unknown) {
  const filter = pageQuery
    .extend({
      query: z.string().max(200).optional(),
      kind: supplierInput.shape.kind.optional(),
      status: supplierInput.shape.status,
    })
    .parse(input);
  const db = await getDatabase();
  const rows = await db.query(
    "SELECT s.*,c.name AS primary_contact_name FROM suppliers s LEFT JOIN supplier_contacts c ON c.supplier_id=s.id AND c.rank='primary' WHERE ($1::text IS NULL OR s.name ILIKE $1 OR s.code ILIKE $1) AND ($2::text IS NULL OR s.kind=$2) AND ($3::text IS NULL OR s.status=$3) AND ($4::text IS NULL OR s.id>$4) ORDER BY s.id LIMIT $5",
    [
      filter.query ? `%${filter.query}%` : null,
      filter.kind ?? null,
      filter.status ?? null,
      filter.cursor ?? null,
      filter.limit + 1,
    ],
  );
  return {
    items: await Promise.all(
      rows
        .slice(0, filter.limit)
        .map(async (r) => ({ ...dto(r), ...(await supplierCounts(db.query, String(r.id))) })),
    ),
    nextCursor: rows.length > filter.limit ? String(rows[filter.limit - 1].id) : null,
  };
}
export async function saveSupplier(id: string | null, input: unknown, actor: string) {
  const data: Row = id
    ? supplierInput.partial().extend({ rowVersion: rowVersionInput }).parse(input)
    : supplierInput.parse(input);
  const { primaryContact, secondaryContact, rowVersion, ...fields } = data;
  return mutate(async (query) => {
    const old = id ? await current(query, 'suppliers', id) : {};
    const merged = { ...old, ...columns(fields) };
    const [existing] = id
      ? await query("SELECT id FROM supplier_contacts WHERE supplier_id=$1 AND rank='primary'", [
          id,
        ])
      : [];
    await validateSupplier(query, merged, primaryContact ?? existing);
    if (
      id &&
      fields.code !== undefined &&
      fields.code !== old.code &&
      (
        await query(
          'SELECT id FROM materials WHERE supplier_id=$1 UNION ALL SELECT id FROM order_items WHERE supplier_id=$1 LIMIT 1',
          [id],
        )
      ).length
    )
      throw new DomainError(
        'code_immutable',
        'This supplier code is locked because it is referenced.',
        409,
      );
    const row = id
      ? await update(query, 'suppliers', id, columns(fields), rowVersion, actor)
      : await insert(query, 'suppliers', { id: crypto.randomUUID(), ...columns(fields) }, actor);
    for (const [rank, contact] of [
      ['primary', primaryContact],
      ['secondary', secondaryContact],
    ] as const)
      if (contact)
        await saveContact(
          query,
          String(row.id),
          rank,
          contact as z.infer<typeof contactInput>,
          actor,
        );
    return supplierDetail(String(row.id), query);
  });
}
export const putSupplierContact = (id: string, rank: string, input: unknown, actor: string) => {
  z.enum(['primary', 'secondary']).parse(rank);
  const { rowVersion, ...data } = contactInput
    .extend({ rowVersion: rowVersionInput.optional() })
    .parse(input);
  return mutate(async (query) => {
    await current(query, 'suppliers', id);
    return saveContact(query, id, rank, data, actor, rowVersion);
  });
};
export const removeSupplierContact = (id: string, rank: string, actor: string) =>
  mutate(async (query) => {
    z.enum(['primary', 'secondary']).parse(rank);
    const supplier = await current(query, 'suppliers', id);
    if (rank === 'primary' && supplier.status === 'active')
      throw new DomainError(
        'primary_contact_required',
        'An active supplier must keep its primary contact.',
        409,
      );
    await query('DELETE FROM supplier_contacts WHERE supplier_id=$1 AND rank=$2', [id, rank]);
    await writeAudit(query, {
      actor,
      action: 'supplier_contacts.deleted',
      entityType: 'suppliers',
      entityId: id,
      summary: { fields: [rank] },
    });
    return { ok: true };
  });
