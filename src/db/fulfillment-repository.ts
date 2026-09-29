import { z } from 'zod';
import { getDatabase, type Query } from './client';
import { type Row, version, missing } from './admin-mutations';
import { writeAudit } from './audit';
import { storedSnapshot, enqueueNotification } from './order-repository';
import { DomainError } from '@/modules/configuration/types';
import type { OrderSnapshot } from '@/modules/orders/submission';
import type { Permission } from '@/modules/staff/permissions';
import {
  allowedTransitions,
  assertAssignment,
  assertTransition,
  assignmentInput,
  clearInput,
  dateInput,
  dateOnly,
  derivedStatus,
  etaInput,
  noteInput,
  opsToday,
  releaseProblems,
  supplierOverdue,
  trackingInput,
  transitionInput,
  versionInput,
} from '@/modules/orders/fulfillment';

const stamp = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const text = (v: unknown) => (v == null ? null : String(v));
// Amendments retain submitted item rows. Resubmission creates a new set.
export const currentItemsClause =
  "i.snapshot_version=(SELECT max(s.version) FROM order_snapshots s WHERE s.order_id=i.order_id AND s.kind='submitted' AND s.version<=o.current_snapshot_version)";
async function orderIn(q: Query, id: string, lock = false) {
  const [o] = await q(`SELECT * FROM orders WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id]);
  return o ?? missing();
}
async function itemsIn(q: Query, id: string) {
  return q(
    `SELECT i.*,s.name AS supplier_name,s.status AS supplier_status,s.kind AS supplier_kind FROM order_items i JOIN orders o ON o.id=i.order_id LEFT JOIN suppliers s ON s.id=i.supplier_id WHERE o.id=$1 AND ${currentItemsClause} ORDER BY i.line_no`,
    [id],
  );
}
async function timezone(q: Query) {
  const [c] = await q('SELECT ops_timezone FROM commerce_settings LIMIT 1');
  return String(c?.ops_timezone ?? 'UTC');
}
const facts = (o: Row, i: Row) => ({
  payment: String(o.payment_status),
  review: String(o.tailor_review_status),
  supplierId: text(i.supplier_id),
  supplierActive: i.supplier_status === 'active' && i.supplier_kind === 'manufacturer',
  dueDate: dateOnly(i.supplier_due_date),
});
export function redactOrderSnapshot(s: OrderSnapshot, measurements: boolean) {
  return {
    ...s,
    measurements: measurements ? s.measurements : null,
    amendment: s.amendment
      ? { ...s.amendment, changedMeasurements: measurements ? s.amendment.changedMeasurements : [] }
      : null,
  };
}
async function adminDetailIn(q: Query, id: string, permissions: readonly Permission[]) {
  const o = await orderIn(q, id),
    snapshot = await storedSnapshot(q, o),
    rows = await itemsIn(q, id),
    zone = await timezone(q),
    today = opsToday(zone);
  const canMeasure = permissions.includes('orders.measurements.read');
  const [customer] = await q('SELECT id,name,email FROM "user" WHERE id=$1', [o.user_id]);
  const reviews = await q(
    'SELECT * FROM review_cases WHERE order_id=$1 ORDER BY created_at DESC,id DESC',
    [id],
  );
  const events = await q('SELECT * FROM order_events WHERE order_id=$1 ORDER BY created_at,id', [
    id,
  ]);
  const notifications = await q(
    'SELECT id,purpose,status,attempts FROM notifications WHERE order_id=$1 ORDER BY created_at,id',
    [id],
  );
  const payments = await q(
    'SELECT id,status,amount_minor,provider_session_id,created_at FROM payments WHERE order_id=$1 ORDER BY created_at,id',
    [id],
  );
  const snapshots = await q(
    'SELECT version,kind,created_at FROM order_snapshots WHERE order_id=$1 ORDER BY version DESC',
    [id],
  );
  return {
    id,
    number: String(o.number),
    rowVersion: Number(o.row_version),
    submittedAt: stamp(o.submitted_at),
    customer: {
      userId: String(customer.id),
      name: String(customer.name),
      email: String(customer.email),
    },
    currency: String(o.currency),
    totalMinor: Number(o.total_minor),
    payment: String(o.payment_status),
    tailorReview: String(o.tailor_review_status),
    fulfillment: String(o.fulfillment_status),
    needsAttention: o.needs_attention === true,
    shippingAddress: o.shipping_address as Record<string, unknown> | null,
    customerEtaDate: dateOnly(o.customer_eta_date),
    opsTimezone: zone,
    snapshot: redactOrderSnapshot(snapshot, canMeasure),
    items: rows.map((i) => {
      const allowed = allowedTransitions(
        String(i.fulfillment_status),
        text(i.hold_resume_status),
      ).filter((s) =>
        s === 'on_hold'
          ? permissions.includes('orders.hold')
          : permissions.includes('orders.fulfillment.write'),
      );
      return {
        id: String(i.id),
        rowVersion: Number(i.row_version),
        lineNo: Number(i.line_no),
        spec: i.spec as OrderSnapshot['items'][number],
        status: String(i.fulfillment_status),
        supplier: i.supplier_id
          ? { id: String(i.supplier_id), name: String(i.supplier_name) }
          : null,
        supplierReference: text(i.supplier_reference),
        dueDate: dateOnly(i.supplier_due_date),
        overdue: supplierOverdue(
          String(i.fulfillment_status),
          dateOnly(i.supplier_due_date),
          today,
        ),
        tracking: i.tracking ? trackingInput.parse(i.tracking) : null,
        holdResumeStatus: text(i.hold_resume_status),
        allowedTransitions: allowed,
        releaseProblems: releaseProblems(facts(o, i)),
      };
    }),
    reviewCases: reviews.map((r) => ({
      id: String(r.id),
      rowVersion: Number(r.row_version),
      status: String(r.status),
      dueAt: r.due_at ? stamp(r.due_at) : null,
      decision: text(r.decision),
      customerResponse: text(r.customer_response),
      customerMessage: canMeasure ? text(r.customer_message) : null,
      measurementsVerifiedAt: r.measurements_verified_at ? stamp(r.measurements_verified_at) : null,
    })),
    events: events.map((e) => ({
      id: String(e.id),
      itemId: text(e.order_item_id),
      type: String(e.type),
      from: text(e.from_value),
      to: text(e.to_value),
      reason: text(e.reason),
      actor: String(e.actor),
      visibleToCustomer: e.visible_to_customer === true,
      createdAt: stamp(e.created_at),
    })),
    notifications: notifications.map((n) => ({
      id: String(n.id),
      purpose: String(n.purpose),
      status: String(n.status),
      attempts: Number(n.attempts),
    })),
    payments: payments.map((p) => ({
      id: String(p.id),
      status: String(p.status),
      amountMinor: Number(p.amount_minor),
      providerSessionId: text(p.provider_session_id),
      createdAt: stamp(p.created_at),
    })),
    snapshots: snapshots.map((s) => ({
      version: Number(s.version),
      kind: String(s.kind),
      createdAt: stamp(s.created_at),
    })),
  };
}
export type AdminOrder = Awaited<ReturnType<typeof adminDetailIn>>;
export async function adminOrder(id: string, permissions: readonly Permission[]) {
  return (await getDatabase()).transaction(async (q) => {
    // Keep the snapshot, items and derived status consistent with concurrent writes.
    await q('SELECT id FROM orders WHERE id=$1 FOR SHARE', [id]);
    return adminDetailIn(q, id, permissions);
  });
}
export async function adminSnapshot(id: string, v: string, canMeasure: boolean) {
  const version = z.coerce.number().int().positive().parse(v),
    q = (await getDatabase()).query;
  await orderIn(q, id);
  const [row] = await q('SELECT snapshot FROM order_snapshots WHERE order_id=$1 AND version=$2', [
    id,
    version,
  ]);
  if (!row) missing();
  return redactOrderSnapshot(row.snapshot as OrderSnapshot, canMeasure);
}
const boolQuery = z.enum(['true', 'false']).optional();
export const orderFilter = z.object({
  query: z.string().trim().max(200).optional(),
  payment: z.string().max(200).optional(),
  tailorReview: z.string().max(200).optional(),
  fulfillment: z.string().max(200).optional(),
  supplierId: z.string().max(100).optional(),
  overdue: boolQuery,
  needsAttention: boolQuery,
  readyToRelease: boolQuery,
  failedNotifications: boolQuery,
  from: dateInput.optional(),
  to: dateInput.optional(),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export async function adminOrders(input: unknown) {
  const f = orderFilter.parse(input),
    q = (await getDatabase()).query,
    zone = await timezone(q),
    today = opsToday(zone);
  const values: unknown[] = [today],
    conditions: string[] = [];
  const param = (v: unknown) => {
    values.push(v);
    return '$' + values.length;
  };
  if (f.query) {
    const p = param('%' + f.query.replace(/[\\%_]/g, '\\$&') + '%');
    conditions.push(`(o.number ILIKE ${p} OR u.email ILIKE ${p})`);
  }
  for (const [key, col] of [
    ['payment', 'payment_status'],
    ['tailorReview', 'tailor_review_status'],
    ['fulfillment', 'fulfillment_status'],
  ] as const)
    if (f[key]) conditions.push(`o.${col}=ANY(${param(f[key]!.split(','))}::text[])`);
  if (f.supplierId)
    conditions.push(
      `EXISTS(SELECT 1 FROM order_items i WHERE i.order_id=o.id AND ${currentItemsClause} AND i.supplier_id=${param(f.supplierId)})`,
    );
  if (f.overdue === 'true') conditions.push('a.overdue');
  if (f.needsAttention === 'true') conditions.push('o.needs_attention');
  if (f.readyToRelease === 'true')
    conditions.push(
      "o.payment_status='succeeded' AND o.tailor_review_status IN ('not_requested','completed') AND o.fulfillment_status='not_released'",
    );
  if (f.failedNotifications === 'true')
    conditions.push(
      "EXISTS(SELECT 1 FROM notifications n WHERE n.order_id=o.id AND n.status='failed')",
    );
  if (f.from) conditions.push(`o.submitted_at >= ${param(f.from)}::date`);
  if (f.to) conditions.push(`o.submitted_at < ${param(f.to)}::date+interval '1 day'`);
  if (f.cursor)
    conditions.push(
      `(o.submitted_at,o.id)<(SELECT submitted_at,id FROM orders WHERE id=${param(f.cursor)})`,
    );
  const rows = await q(
    `SELECT o.*,u.name AS customer_name,a.* FROM orders o JOIN "user" u ON u.id=o.user_id CROSS JOIN LATERAL (SELECT count(*)::int AS item_count,min(i.supplier_due_date) FILTER(WHERE i.fulfillment_status NOT IN ('shipped','delivered','completed','cancelled')) AS next_due_date,coalesce(bool_or(i.supplier_due_date<$1::date AND i.fulfillment_status IN ('released','in_production','quality_check')),false) AS overdue,coalesce(jsonb_agg(DISTINCT jsonb_build_object('id',s.id,'name',s.name)) FILTER(WHERE s.id IS NOT NULL),'[]') AS suppliers FROM order_items i LEFT JOIN suppliers s ON s.id=i.supplier_id WHERE i.order_id=o.id AND ${currentItemsClause}) a ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY o.submitted_at DESC,o.id DESC LIMIT ${param(f.limit + 1)}`,
    values,
  );
  return {
    items: rows.slice(0, f.limit).map((o) => ({
      id: String(o.id),
      number: String(o.number),
      submittedAt: stamp(o.submitted_at),
      customerName: String(o.customer_name),
      itemCount: Number(o.item_count),
      totalMinor: Number(o.total_minor),
      currency: String(o.currency),
      payment: String(o.payment_status),
      tailorReview: String(o.tailor_review_status),
      fulfillment: String(o.fulfillment_status),
      suppliers: o.suppliers as { id: string; name: string }[],
      nextDueDate: dateOnly(o.next_due_date),
      overdue: o.overdue === true,
      needsAttention: o.needs_attention === true,
    })),
    nextCursor: rows.length > f.limit ? String(rows[f.limit - 1].id) : null,
    opsTimezone: zone,
  };
}
export type AdminOrders = Awaited<ReturnType<typeof adminOrders>>;
async function event(
  q: Query,
  order: Row,
  actor: string,
  type: string,
  item: Row | null,
  from: unknown,
  to: unknown,
  reason?: string,
  visible = false,
) {
  const id = crypto.randomUUID();
  await q(
    'INSERT INTO order_events(id,order_id,order_item_id,type,from_value,to_value,reason,actor,visible_to_customer,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp())',
    [id, order.id, item?.id ?? null, type, text(from), text(to), reason ?? null, actor, visible],
  );
  await writeAudit(q, {
    actor,
    action: 'orders.' + type,
    entityType: item ? 'order_items' : 'orders',
    entityId: String(item?.id ?? order.id),
    summary: { fields: [type] },
  });
  return id;
}
async function bumpOrder(q: Query, order: Row) {
  const items = await itemsIn(q, String(order.id));
  await q(
    'UPDATE orders SET fulfillment_status=$2,row_version=row_version+1,updated_at=now() WHERE id=$1',
    [order.id, derivedStatus(items.map((i) => String(i.fulfillment_status)))],
  );
}
async function assignIn(
  q: Query,
  o: Row,
  i: Row,
  data: z.infer<typeof assignmentInput>,
  actor: string,
) {
  if (o.payment_status !== 'succeeded')
    throw new DomainError(
      'order_state_invalid',
      'Payment must be received before assigning a supplier.',
      409,
    );
  const [s] = await q('SELECT id,status,kind FROM suppliers WHERE id=$1 FOR SHARE', [
    data.supplierId,
  ]);
  if (
    !s ||
    (i.supplier_id !== data.supplierId && (s.status !== 'active' || s.kind !== 'manufacturer'))
  )
    throw new DomainError('supplier_inactive', 'Choose an active manufacturer.', 409);
  const changedSupplier = i.supplier_id !== data.supplierId,
    changedDate = dateOnly(i.supplier_due_date) !== data.dueDate;
  assertAssignment(
    String(i.fulfillment_status),
    text(i.hold_resume_status),
    changedSupplier,
    !!((changedSupplier && i.supplier_id) || (changedDate && i.supplier_due_date)),
    data.reason,
  );
  await q(
    'UPDATE order_items SET supplier_id=$2,supplier_reference=$3,supplier_due_date=$4,row_version=row_version+1,updated_at=now() WHERE id=$1',
    [
      i.id,
      data.supplierId,
      data.supplierReference === undefined ? i.supplier_reference : data.supplierReference,
      data.dueDate,
    ],
  );
  if (changedSupplier)
    await event(q, o, actor, 'supplier_assigned', i, i.supplier_id, data.supplierId, data.reason);
  if (changedDate)
    await event(
      q,
      o,
      actor,
      'deadline_changed',
      i,
      dateOnly(i.supplier_due_date),
      data.dueDate,
      data.reason,
    );
  if (!changedSupplier && !changedDate)
    await event(q, o, actor, 'supplier_reference_changed', i, null, null, data.reason);
}
export async function assignOrder(
  id: string,
  itemId: string | null,
  input: unknown,
  actor: string,
) {
  const data = assignmentInput.parse(input);
  await (
    await getDatabase()
  ).transaction(async (q) => {
    const o = await orderIn(q, id, true),
      items = await itemsIn(q, id);
    if (!itemId) version(o, data.rowVersion);
    const selected = itemId
      ? items.filter((i) => i.id === itemId)
      : items.filter((i) => i.fulfillment_status !== 'cancelled');
    if (!selected.length) missing();
    if (itemId) version(selected[0], data.rowVersion);
    for (const i of selected) await assignIn(q, o, i, data, actor);
    await bumpOrder(q, o);
  });
}
async function transitionIn(
  q: Query,
  o: Row,
  i: Row,
  data: z.infer<typeof transitionInput>,
  actor: string,
) {
  if (data.to === 'released' && i.fulfillment_status === 'not_released' && i.supplier_id) {
    const [s] = await q('SELECT status,kind FROM suppliers WHERE id=$1 FOR SHARE', [i.supplier_id]);
    i.supplier_status = s?.status;
    i.supplier_kind = s?.kind;
  }
  assertTransition(String(i.fulfillment_status), text(i.hold_resume_status), data, facts(o, i));
  await q(
    'UPDATE order_items SET fulfillment_status=$2,hold_resume_status=$3,tracking=$4,row_version=row_version+1,updated_at=now() WHERE id=$1',
    [
      i.id,
      data.to,
      data.to === 'on_hold' ? i.fulfillment_status : null,
      JSON.stringify(data.tracking ?? i.tracking ?? null),
    ],
  );
  const eventId = await event(
    q,
    o,
    actor,
    'status_changed',
    i,
    i.fulfillment_status,
    data.to,
    data.reason,
    true,
  );
  if (data.to === 'shipped') {
    await event(q, o, actor, 'tracking_added', i, null, null, undefined, true);
    await enqueueNotification(q, o, 'order_shipped', eventId);
  }
  if (data.to === 'cancelled' && o.payment_status === 'succeeded') {
    await q('UPDATE orders SET needs_attention=true WHERE id=$1', [o.id]);
    await enqueueNotification(q, o, 'order_cancelled', eventId);
  }
}
export async function transitionOrderItem(
  id: string,
  itemId: string,
  input: unknown,
  actor: string,
) {
  const data = transitionInput.parse(input);
  await (
    await getDatabase()
  ).transaction(async (q) => {
    const o = await orderIn(q, id, true),
      i = (await itemsIn(q, id)).find((i) => i.id === itemId);
    if (!i) missing();
    version(i, data.rowVersion);
    await transitionIn(q, o, i, data, actor);
    await bumpOrder(q, o);
  });
}
export async function releaseOrder(id: string, input: unknown, actor: string) {
  const data = versionInput.parse(input);
  await (
    await getDatabase()
  ).transaction(async (q) => {
    const o = await orderIn(q, id, true);
    version(o, data.rowVersion);
    const items = (await itemsIn(q, id)).filter((i) => i.fulfillment_status !== 'cancelled');
    if (!items.length)
      throw new DomainError('transition_not_allowed', 'There are no items to release.', 409);
    for (const i of items)
      await transitionIn(q, o, i, { rowVersion: Number(i.row_version), to: 'released' }, actor);
    await bumpOrder(q, o);
  });
}
export async function updateOrderMeta(
  id: string,
  kind: 'eta' | 'attention',
  input: unknown,
  actor: string,
) {
  const data = kind === 'eta' ? etaInput.parse(input) : clearInput.parse(input);
  await (
    await getDatabase()
  ).transaction(async (q) => {
    const o = await orderIn(q, id, true);
    version(o, data.rowVersion);
    if ('customerEtaDate' in data) {
      await q(
        'UPDATE orders SET customer_eta_date=$2,row_version=row_version+1,updated_at=now() WHERE id=$1',
        [id, data.customerEtaDate],
      );
      await event(
        q,
        o,
        actor,
        'eta_changed',
        null,
        dateOnly(o.customer_eta_date),
        data.customerEtaDate,
        data.reason,
        true,
      );
    } else {
      await q(
        'UPDATE orders SET needs_attention=false,row_version=row_version+1,updated_at=now() WHERE id=$1',
        [id],
      );
      await event(q, o, actor, 'attention_cleared', null, null, null, data.reason);
    }
  });
}
export async function addOrderNote(id: string, input: unknown, actor: string) {
  const data = noteInput.parse(input);
  return (await getDatabase()).transaction(async (q) => {
    const o = await orderIn(q, id, true);
    const eventId = await event(
      q,
      o,
      actor,
      'note',
      null,
      null,
      null,
      data.body,
      data.visibility === 'customer',
    );
    await q('UPDATE orders SET row_version=row_version+1,updated_at=now() WHERE id=$1', [id]);
    return { id: eventId };
  });
}
export async function retryNotification(id: string, actor: string) {
  return (await getDatabase()).transaction(async (q) => {
    const [found] = await q('SELECT order_id FROM notifications WHERE id=$1', [id]);
    if (!found) missing();
    const o = await orderIn(q, String(found.order_id), true);
    const [n] = await q('SELECT * FROM notifications WHERE id=$1 FOR UPDATE', [id]);
    if (n.status !== 'failed')
      throw new DomainError(
        'notification_state_invalid',
        'Only failed notifications can be retried.',
        409,
      );
    await q("UPDATE notifications SET status='pending' WHERE id=$1", [id]);
    await event(q, o, actor, 'notification_retried', null, null, null);
    return String(o.number);
  });
}
export async function productionSheet(id: string, itemId: string) {
  return (await getDatabase()).transaction(async (q) => {
    await q('SELECT id FROM orders WHERE id=$1 FOR SHARE', [id]);
    const o = await orderIn(q, id),
      snapshot = await storedSnapshot(q, o),
      item = (await itemsIn(q, id)).find((i) => i.id === itemId);
    if (!item) missing();
    const [review] = await q(
      "SELECT measurements_verified_at FROM review_cases WHERE order_id=$1 AND status='completed' ORDER BY created_at DESC LIMIT 1",
      [id],
    );
    return {
      number: snapshot.number,
      customerName: snapshot.customer.name,
      snapshotVersion: snapshot.version,
      signedOffAt: snapshot.signoff.at,
      statementVersion: snapshot.signoff.statementVersion,
      item: item.spec as OrderSnapshot['items'][number],
      measurements: snapshot.measurements,
      amended: snapshot.kind === 'amendment',
      tailorVerified: !!review?.measurements_verified_at,
    };
  });
}
export type ProductionSheet = Awaited<ReturnType<typeof productionSheet>>;
export async function supplierItems(id: string, input: unknown) {
  const f = z
      .object({
        status: z.enum(['open', 'overdue', 'completed', 'all']).default('open'),
        overdue: z.enum(['true', 'false']).optional(),
        cursor: z.string().max(100).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      })
      .parse(input),
    q = (await getDatabase()).query;
  if (!(await q('SELECT id FROM suppliers WHERE id=$1', [id])).length) missing();
  const zone = await timezone(q),
    today = opsToday(zone);
  const rows = await q(
    `SELECT i.*,o.number FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.supplier_id=$1 AND ${currentItemsClause} AND ($2='all' OR ($2='open' AND i.fulfillment_status NOT IN ('delivered','completed','cancelled')) OR ($2='completed' AND i.fulfillment_status IN ('delivered','completed','cancelled')) OR ($2='overdue' AND i.fulfillment_status IN ('released','in_production','quality_check') AND i.supplier_due_date<$3::date)) AND ($4::text IS NULL OR i.id>$4) ORDER BY i.id LIMIT $5`,
    [id, f.overdue === 'true' ? 'overdue' : f.status, today, f.cursor ?? null, f.limit + 1],
  );
  return {
    items: rows.slice(0, f.limit).map((i) => ({
      id: String(i.id),
      itemId: String(i.id),
      lineNo: Number(i.line_no),
      orderId: String(i.order_id),
      number: String(i.number),
      productName: (i.spec as OrderSnapshot['items'][number]).product.name,
      quantity: Number(i.quantity),
      dueDate: dateOnly(i.supplier_due_date),
      status: String(i.fulfillment_status),
      overdue: supplierOverdue(String(i.fulfillment_status), dateOnly(i.supplier_due_date), today),
    })),
    nextCursor: rows.length > f.limit ? String(rows[f.limit - 1].id) : null,
    opsTimezone: zone,
  };
}
