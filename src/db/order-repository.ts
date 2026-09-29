import { z } from 'zod';
import { getDatabase, type Query } from './client';
import { getDraft } from './repository';
import { ensureCatalog, PUBLISH_LOCK } from './release-repository';
import { upgradeDraft } from '@/modules/configuration/upgrade';
import { DomainError, type DraftV2, type OrderCheck } from '@/modules/configuration/types';
import { indexSnapshot, parseSnapshot } from '@/modules/catalog/snapshot';
import type { MaterialAvailability } from '@/modules/catalog/garment';
import { CHECK_POLICY, orderFindings } from '@/modules/orders/check-policy';
import {
  advisoryContext,
  advisoryFindings,
  type AdvisoryProvider,
} from '@/modules/orders/advisory';
import {
  submitInput,
  validateSubmission,
  buildSnapshot,
  orderSnapshotSchema,
  type OrderSnapshot,
} from '@/modules/orders/submission';
import { productionLabel, eventLabels } from '@/modules/orders/customer-status';
import { isOverdue, reviewTransition, type ReviewStatus } from '@/modules/orders/tailor-review';
import { checksum } from '@/lib/canonical-json';
import { VISUAL_SLOTS } from '@/visualization/registry';
import packageInfo from '../../package.json';
import { dto, type Row } from './admin-mutations';
import { writeAudit } from './audit';
import { dateOnly, trackingInput } from '@/modules/orders/fulfillment';

const failure = (code: string, message: string, status = 409): never => {
  throw new DomainError(code, message, status);
};
export const actionInput = z.strictObject({ actionId: z.uuid() });
const checkInput = actionInput.extend({ expectedRevision: z.number().int().nonnegative() });
const at = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value));
export async function orderEvent(
  q: Query,
  orderId: string,
  type: string,
  actor: string,
  visible = false,
  data: Record<string, unknown> = {},
) {
  await q(
    'INSERT INTO order_events(id,order_id,type,actor,visible_to_customer,data,created_at) VALUES($1,$2,$3,$4,$5,$6,clock_timestamp())',
    [crypto.randomUUID(), orderId, type, actor, visible, JSON.stringify(data)],
  );
}
export async function enqueueNotification(
  q: Query,
  order: Row,
  purpose: string,
  discriminator: string,
) {
  await q(
    'INSERT INTO notifications(id,order_id,recipient_user_id,purpose,dedupe_key,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(dedupe_key) DO NOTHING',
    [
      crypto.randomUUID(),
      order.id,
      order.user_id,
      purpose,
      `${purpose}:${order.id}:${discriminator}`,
      JSON.stringify({
        number: order.number,
        status: purpose,
        totalMinor: order.total_minor,
        currency: order.currency,
      }),
    ],
  );
}
export async function lockedOrder(q: Query, number: string, owner?: string) {
  const [row] = await q('SELECT * FROM orders WHERE number=$1 FOR UPDATE', [number]);
  if (!row || (owner && row.owner !== owner))
    return failure('order_not_found', 'Order not found.', 404);
  return row;
}
export async function storedSnapshot(q: Query, order: Row): Promise<OrderSnapshot> {
  const [row] = await q('SELECT snapshot FROM order_snapshots WHERE order_id=$1 AND version=$2', [
    order.id,
    order.current_snapshot_version,
  ]);
  return orderSnapshotSchema.parse(row.snapshot);
}
async function contextIn(q: Query, draft: DraftV2) {
  const [release] = await q('SELECT snapshot FROM catalog_releases ORDER BY version DESC LIMIT 1');
  if (!release) return failure('catalog_unavailable', 'The catalog is unavailable.', 503);
  const snapshot = parseSnapshot(release.snapshot),
    current = indexSnapshot(snapshot),
    releases = new Map([[snapshot.version, current]]);
  for (const v of new Set(draft.garments.map((g) => g.catalogVersion)))
    if (!releases.has(v)) {
      const [row] = await q('SELECT snapshot FROM catalog_releases WHERE version=$1', [v]);
      if (row) releases.set(v, indexSnapshot(parseSnapshot(row.snapshot)));
    }
  const rows = await q<{ code: string; availability: MaterialAvailability }>(
    'SELECT code,availability FROM materials',
  );
  return {
    snapshot,
    context: {
      current,
      releases,
      availability: Object.fromEntries(rows.map((m) => [m.code, m.availability])),
    },
  };
}
async function lockedDraft(q: Query, owner: string) {
  const [row] = await q('SELECT * FROM drafts WHERE owner=$1 FOR UPDATE', [owner]);
  if (!row) return failure('draft_not_found', 'Open the studio first.', 404);
  return { row, draft: upgradeDraft(row.data as DraftV2) };
}
export async function runOrderCheck(
  owner: string,
  input: unknown,
  advisoryProvider?: AdvisoryProvider,
) {
  if (owner.startsWith('preview:'))
    return failure('order_state_invalid', 'Preview drafts cannot be ordered.');
  const data = checkInput.parse(input),
    hash = checksum({ owner, kind: 'order_check', ...data });
  await ensureCatalog();
  const initial = await getDraft(owner);
  const db = await getDatabase();
  const [replay] = await db.query('SELECT * FROM actions WHERE id=$1', [data.actionId]);
  if (replay) {
    if (replay.draft_id !== initial.id || replay.fingerprint !== hash)
      return failure('action_conflict', 'This action has already been used.');
    return upgradeDraft(replay.result as DraftV2);
  }
  if (initial.revision !== data.expectedRevision)
    return failure('revision_conflict', 'Your draft changed. Run the check again.');
  const before = await db.transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock($1)', [PUBLISH_LOCK]);
    return contextIn(q, initial);
  });
  // Advice waits outside any database transaction. Recheck revision and live
  // facts below; a provider can never mutate the deterministic findings.
  const advice = await advisoryFindings(advisoryContext(initial, before.context), advisoryProvider);
  return (await getDatabase()).transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock($1)', [PUBLISH_LOCK]);
    const { row, draft } = await lockedDraft(q, owner);
    const [prior] = await q('SELECT * FROM actions WHERE id=$1', [data.actionId]);
    if (prior) {
      if (prior.draft_id !== row.id || prior.fingerprint !== hash)
        return failure('action_conflict', 'This action has already been used.');
      return upgradeDraft(prior.result as DraftV2);
    }
    if (draft.revision !== data.expectedRevision)
      return failure('revision_conflict', 'Your draft changed. Run the check again.');
    const { context } = await contextIn(q, draft);
    const unchangedCatalog = context.current.catalog.version === before.snapshot.version;
    const findings = [
      ...orderFindings(draft, context),
      ...(unchangedCatalog ? advice.findings : []),
    ];
    const review: OrderCheck = {
      id: crypto.randomUUID(),
      inputRevision: draft.revision,
      policyVersion: CHECK_POLICY,
      status: findings.some((f) => f.severity === 'blocker') ? 'correction_required' : 'passed',
      findings,
      aiAdvisory: unchangedCatalog ? advice.aiAdvisory : 'unavailable',
      createdAt: new Date().toISOString(),
    };
    const next = { ...draft, review };
    await q('UPDATE drafts SET data=$1,updated_at=now() WHERE id=$2', [
      JSON.stringify(next),
      row.id,
    ]);
    await q('INSERT INTO actions(id,draft_id,fingerprint,result) VALUES($1,$2,$3,$4)', [
      data.actionId,
      row.id,
      hash,
      JSON.stringify(next),
    ]);
    return next;
  });
}
export async function orderAction(
  q: Query,
  owner: string,
  actionId: string,
  kind: string,
  input: unknown,
  number?: string,
) {
  await q('SELECT pg_advisory_xact_lock(hashtext($1))', [actionId]);
  const fingerprint = checksum({ owner, kind, number: number ?? null, input });
  const [previous] = await q(
    "SELECT o.number,o.owner,e.data FROM order_events e JOIN orders o ON o.id=e.order_id WHERE e.data->>'actionId'=$1",
    [actionId],
  );
  if (previous) {
    if (previous.owner !== owner || (previous.data as Row).fingerprint !== fingerprint)
      return failure('action_conflict', 'This action identifier has already been used.');
    return { fingerprint, replay: String(previous.number) };
  }
  return { fingerprint, replay: null };
}
export async function submitOrder(owner: string, input: unknown, number?: string) {
  if (!owner.startsWith('user:'))
    return failure('sign_in_required', 'Sign in to place your order.', 401);
  const data = submitInput.parse(input);
  await ensureCatalog();
  await getDraft(owner);
  return (await getDatabase()).transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock($1)', [PUBLISH_LOCK]);
    const action = await orderAction(
      q,
      owner,
      data.actionId,
      number ? 'resubmit' : 'submit',
      data,
      number,
    );
    if (action.replay) return { number: action.replay, replayed: true };
    const existing = number ? await lockedOrder(q, number, owner) : null;
    if (existing) {
      if (
        existing.fulfillment_status === 'cancelled' ||
        !['checkout_ready', 'failed', 'cancelled'].includes(String(existing.payment_status)) ||
        (
          await q(
            "SELECT id FROM payments WHERE order_id=$1 AND status IN ('payment_pending','succeeded','refund_pending','refunded')",
            [existing.id],
          )
        ).length
      )
        return failure('order_state_invalid', 'This order cannot be resubmitted.');
    }
    const { draft } = await lockedDraft(q, owner),
      { snapshot: catalog, context } = await contextIn(q, draft);
    const quote = validateSubmission(owner, draft, context, data);
    const [user] = await q('SELECT id,name,email FROM "user" WHERE id=$1', [owner.slice(5)]);
    if (!user) return failure('sign_in_required', 'Sign in to place your order.', 401);
    const id = existing ? String(existing.id) : crypto.randomUUID(),
      version = existing ? Number(existing.current_snapshot_version) + 1 : 1;
    const seq = existing ? null : (await q("SELECT nextval('order_number_seq') AS n"))[0];
    const orderNumber = existing
      ? String(existing.number)
      : `${catalog.settings.orderNumberPrefix}-${String(seq!.n).padStart(6, '0')}`;
    const now = new Date().toISOString(),
      quoteId = crypto.randomUUID(),
      expiresAt = new Date(Date.now() + catalog.settings.quoteTtlMinutes * 60_000).toISOString();
    const snapshot = buildSnapshot(
      draft,
      catalog,
      { userId: String(user.id), name: String(user.name), email: String(user.email) },
      {
        id,
        number: orderNumber,
        version,
        quoteId,
        at: now,
        expiresAt,
        renderer: `${packageInfo.version}:${checksum(VISUAL_SLOTS)}`,
        tailorReview: data.tailorReview as boolean,
      },
    );
    await q(
      'INSERT INTO quotes(id,owner,draft_id,draft_revision,catalog_version,currency,lines,subtotal_minor,shipping_minor,total_minor,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        quoteId,
        owner,
        draft.id,
        draft.revision,
        catalog.version,
        quote.currency,
        JSON.stringify(quote.garments),
        quote.subtotalMinor,
        quote.shippingMinor,
        quote.totalMinor,
        expiresAt,
      ],
    );
    const reviewStatus = data.tailorReview ? 'awaiting_payment' : 'not_requested';
    if (!existing)
      await q(
        'INSERT INTO orders(id,number,owner,user_id,draft_id,draft_revision,current_snapshot_version,quote_id,catalog_version,currency,subtotal_minor,shipping_minor,total_minor,signed_off_at,signoff_statement_version,tailor_review_requested,tailor_review_status,submit_action_id,submit_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)',
        [
          id,
          orderNumber,
          owner,
          user.id,
          draft.id,
          draft.revision,
          version,
          quoteId,
          catalog.version,
          quote.currency,
          quote.subtotalMinor,
          quote.shippingMinor,
          quote.totalMinor,
          now,
          snapshot.signoff.statementVersion,
          data.tailorReview,
          reviewStatus,
          data.actionId,
          action.fingerprint,
        ],
      );
    else {
      await q(
        "UPDATE review_cases SET status='cancelled',row_version=row_version+1,updated_at=now() WHERE order_id=$1 AND status='awaiting_payment'",
        [id],
      );
      await q(
        "UPDATE orders SET draft_id=$1,draft_revision=$2,current_snapshot_version=$3,quote_id=$4,catalog_version=$5,currency=$6,subtotal_minor=$7,shipping_minor=$8,total_minor=$9,signed_off_at=$10,signoff_statement_version=$11,tailor_review_requested=$12,tailor_review_status=$13,payment_status='checkout_ready',row_version=row_version+1,updated_at=now() WHERE id=$14",
        [
          draft.id,
          draft.revision,
          version,
          quoteId,
          catalog.version,
          quote.currency,
          quote.subtotalMinor,
          quote.shippingMinor,
          quote.totalMinor,
          now,
          snapshot.signoff.statementVersion,
          data.tailorReview,
          reviewStatus,
          id,
        ],
      );
    }
    await q(
      "INSERT INTO order_snapshots(order_id,version,kind,snapshot,checksum,quote_id,action_id,created_by) VALUES($1,$2,'submitted',$3,$4,$5,$6,$7)",
      [id, version, JSON.stringify(snapshot), checksum(snapshot), quoteId, data.actionId, owner],
    );
    for (const item of snapshot.items)
      await q(
        'INSERT INTO order_items(id,order_id,snapshot_version,line_no,product_code,template_code,quantity,unit_price_minor,line_total_minor,spec) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [
          crypto.randomUUID(),
          id,
          version,
          item.lineNo,
          item.product.code,
          item.template?.code ?? null,
          item.quantity,
          item.quote.unitMinor,
          item.quote.totalMinor,
          JSON.stringify({ ...item, number: orderNumber, version }),
        ],
      );
    if (data.tailorReview)
      await q(
        "INSERT INTO review_cases(id,order_id,snapshot_version,status) VALUES($1,$2,$3,'awaiting_payment')",
        [crypto.randomUUID(), id, version],
      );
    await orderEvent(q, id, existing ? 'order_resubmitted' : 'order_submitted', owner, true, {
      actionId: data.actionId,
      fingerprint: action.fingerprint,
      statementVersion: snapshot.signoff.statementVersion,
      version,
    });
    const next = {
      ...draft,
      orders: [
        ...draft.orders.filter((o) => o.orderId !== id),
        { orderId: id, number: orderNumber, submittedAt: now },
      ],
    };
    await q('UPDATE drafts SET data=$1 WHERE id=$2', [JSON.stringify(next), draft.id]);
    return { number: orderNumber, replayed: false };
  });
}
export async function cancelOrder(owner: string, number: string, input: unknown) {
  const data = actionInput.extend({ reason: z.string().max(500).optional() }).parse(input);
  return (await getDatabase()).transaction(async (q) => {
    const action = await orderAction(q, owner, data.actionId, 'cancel', data, number);
    if (action.replay) return;
    const order = await lockedOrder(q, number, owner);
    if (
      !['checkout_ready', 'failed', 'cancelled'].includes(String(order.payment_status)) ||
      order.fulfillment_status === 'cancelled'
    )
      return failure(
        'order_state_invalid',
        'Only an unpaid order with no payment in progress can be cancelled.',
      );
    if (
      (
        await q(
          "SELECT id FROM payments WHERE order_id=$1 AND status IN ('payment_pending','succeeded','refund_pending','refunded')",
          [order.id],
        )
      ).length
    )
      return failure('order_state_invalid', 'Payment is still being confirmed.');
    await q(
      "UPDATE orders SET fulfillment_status='cancelled',tailor_review_status=CASE WHEN tailor_review_requested THEN 'cancelled' ELSE tailor_review_status END,row_version=row_version+1,updated_at=now() WHERE id=$1",
      [order.id],
    );
    await q(
      "UPDATE review_cases SET status='cancelled',row_version=row_version+1,updated_at=now() WHERE order_id=$1 AND status NOT IN ('completed','cancelled')",
      [order.id],
    );
    await orderEvent(q, String(order.id), 'order_cancelled', owner, true, {
      actionId: data.actionId,
      fingerprint: action.fingerprint,
      reason: data.reason ?? null,
    });
    // NTF-001: an unpaid order sends no email.
  });
}
export async function openOnPayment(q: Query, order: Row, paidAt = new Date()) {
  const cases = await q(
    "UPDATE review_cases SET status='pending',due_at=$2,row_version=row_version+1,updated_at=now() WHERE order_id=$1 AND snapshot_version=$3 AND status='awaiting_payment' RETURNING id",
    [order.id, new Date(paidAt.getTime() + 86400_000), order.current_snapshot_version],
  );
  if (cases.length) {
    await q(
      "UPDATE orders SET tailor_review_status='pending',row_version=row_version+1 WHERE id=$1",
      [order.id],
    );
    await orderEvent(q, String(order.id), 'tailor_review_opened', 'system:payment', true);
  }
}
export async function recordOverdue(q: Query, orderId?: string) {
  const rows = await q(
    "SELECT id,order_id FROM review_cases WHERE overdue_notified_at IS NULL AND status IN ('pending','in_review') AND due_at<now() AND ($1::text IS NULL OR order_id=$1) ORDER BY order_id,id LIMIT 100",
    [orderId ?? null],
  );
  for (const c of rows) {
    const [o] = await q('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [c.order_id]);
    const updated = await q(
      "UPDATE review_cases SET overdue_notified_at=now() WHERE id=$1 AND overdue_notified_at IS NULL AND status IN ('pending','in_review') AND due_at<now() RETURNING id",
      [c.id],
    );
    if (!updated.length) continue;
    await orderEvent(q, String(o.id), 'tailor_review_overdue', 'system:review', true);
    await enqueueNotification(q, o, 'tailor_review_delayed', String(c.id));
  }
}
export async function customerOrder(owner: string, number: string) {
  const db = await getDatabase();
  const [o] = await db.query('SELECT * FROM orders WHERE number=$1 AND owner=$2', [number, owner]);
  if (!o) return failure('order_not_found', 'Order not found.', 404);
  await db.transaction((q) => recordOverdue(q, String(o.id)));
  const snapshot = await storedSnapshot(db.query, o),
    [review] = await db.query(
      'SELECT * FROM review_cases WHERE order_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',
      [o.id],
    );
  const items = await db.query(
    'SELECT line_no,fulfillment_status,tracking FROM order_items WHERE order_id=$1 AND snapshot_version=$2 ORDER BY line_no',
    [
      o.id,
      snapshot.amendment
        ? (
            await db.query(
              "SELECT max(version) AS v FROM order_snapshots WHERE order_id=$1 AND kind='submitted'",
              [o.id],
            )
          )[0].v
        : o.current_snapshot_version,
    ],
  );
  const events = await db.query(
    'SELECT type,to_value,reason,created_at FROM order_events WHERE order_id=$1 AND visible_to_customer ORDER BY created_at,id',
    [o.id],
  );
  const proposed = (review?.proposed_measurements ?? {}) as Record<string, number>;
  const expired = new Date(snapshot.totals.expiresAt).getTime() <= Date.now();
  const unpaid =
    ['checkout_ready', 'failed', 'cancelled'].includes(String(o.payment_status)) &&
    o.fulfillment_status !== 'cancelled';
  return {
    number: String(o.number),
    submittedAt: at(o.submitted_at),
    signedOffAt: at(o.signed_off_at),
    statementVersion: snapshot.signoff.statementVersion,
    currency: String(o.currency),
    totalMinor: Number(o.total_minor),
    subtotalMinor: Number(o.subtotal_minor),
    shippingMinor: Number(o.shipping_minor),
    check: {
      aiAdvisory: snapshot.check.aiAdvisory,
      advice: snapshot.check.findings.map((f) => ({ title: f.title, description: f.description })),
    },
    tailorReview: {
      requested: o.tailor_review_requested === true,
      status: String(o.tailor_review_status),
      dueAt: review?.due_at ? at(review.due_at) : null,
      overdue: isOverdue(String(review?.status), review?.due_at as Date | null),
      customerMessage: (review?.customer_message as string | null) ?? null,
      proposedChanges: snapshot.measurements.values
        .filter((m) => proposed[m.id] !== undefined)
        .map((m) => ({ id: m.id, label: m.label, currentMm: m.mm, proposedMm: proposed[m.id] })),
      response: (review?.customer_response as string | null) ?? null,
      verified: !!review?.measurements_verified_at,
      awaitingCustomerSince: review?.status === 'awaiting_customer' ? at(review.decided_at) : null,
    },
    payment: { status: String(o.payment_status) },
    fulfillment: {
      status: String(o.fulfillment_status),
      label: productionLabel(
        String(o.fulfillment_status),
        String(o.payment_status),
        String(o.tailor_review_status),
      ),
      etaDate: dateOnly(o.customer_eta_date),
    },
    items: snapshot.items.map((item, i) => ({
      lineNo: item.lineNo,
      productName: item.product.name,
      templateName: item.template?.name ?? null,
      materialName: item.material.name,
      quantity: item.quantity,
      lineTotalMinor: item.quote.totalMinor,
      options: item.options.map((option) => ({
        group: option.groupName,
        option: option.attributeName,
        choice: option.text ?? option.valueLabel ?? '—',
        lineKind: option.lineKind,
      })),
      status: String(items[i]?.fulfillment_status ?? 'not_released'),
      statusLabel: productionLabel(
        String(items[i]?.fulfillment_status ?? 'not_released'),
        String(o.payment_status),
        String(o.tailor_review_status),
      ),
      tracking: items[i]?.tracking ? trackingInput.parse(items[i].tracking) : null,
    })),
    measurements: snapshot.measurements,
    timeline: events.map((e) => ({
      at: at(e.created_at),
      label:
        e.type === 'note'
          ? String(e.reason)
          : e.type === 'status_changed'
            ? productionLabel(
                String(e.to_value),
                String(o.payment_status),
                String(o.tailor_review_status),
              )
            : (eventLabels[String(e.type)] ?? 'Order updated'),
    })),
    actions: [
      ...(unpaid ? ['resubmit', 'cancel', ...(!expired ? ['pay'] : [])] : []),
      ...(o.tailor_review_status === 'awaiting_customer' ? ['respond_tailor'] : []),
    ],
    snapshotVersion: Number(o.current_snapshot_version),
    quoteExpired: expired,
    amendment: snapshot.amendment,
  };
}
export type CustomerOrder = Awaited<ReturnType<typeof customerOrder>>;
export async function customerOrders(owner: string, input: { cursor?: string; limit?: string }) {
  const filter = z
      .object({
        cursor: z.string().max(100).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(input),
    db = await getDatabase();
  const rows = await db.query(
    'SELECT number FROM orders WHERE owner=$1 AND ($2::text IS NULL OR (submitted_at,id)<(SELECT submitted_at,id FROM orders WHERE owner=$1 AND number=$2)) ORDER BY submitted_at DESC,id DESC LIMIT $3',
    [owner, filter.cursor ?? null, filter.limit + 1],
  );
  const items = [];
  for (const row of rows.slice(0, filter.limit)) {
    const d = await customerOrder(owner, String(row.number));
    items.push({
      number: d.number,
      submittedAt: d.submittedAt,
      totalMinor: d.totalMinor,
      currency: d.currency,
      tailorReview: d.tailorReview,
      payment: d.payment,
      fulfillment: d.fulfillment,
    });
  }
  return {
    items,
    nextCursor: rows.length > filter.limit ? String(rows[filter.limit - 1].number) : null,
  };
}
async function reviewFor(q: Query, id: string) {
  // Lock order before case, consistently with payment reconciliation and amendments.
  const [found] = await q('SELECT order_id FROM review_cases WHERE id=$1', [id]);
  if (!found) return failure('review_not_found', 'Review not found.', 404);
  const [order] = await q('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [found.order_id]);
  const [review] = await q('SELECT * FROM review_cases WHERE id=$1 FOR UPDATE', [id]);
  return { order, review };
}
export async function reviewQueue(actorId: string, filter: Record<string, string>) {
  const db = await getDatabase();
  await db.transaction((q) => recordOverdue(q));
  const rows = await db.query(
    "SELECT r.*,o.number,u.name AS customer_name,(SELECT min(created_at) FROM order_events e WHERE e.order_id=o.id AND e.type='payment_succeeded') AS paid_at FROM review_cases r JOIN orders o ON o.id=r.order_id JOIN \"user\" u ON u.id=o.user_id WHERE r.status=ANY($1) ORDER BY CASE WHEN r.status IN ('pending','in_review') AND r.due_at<now() THEN 0 ELSE 1 END,r.due_at,r.id",
    [filter.status ? filter.status.split(',') : ['pending', 'in_review', 'awaiting_customer']],
  );
  const filtered = rows.filter(
    (r) =>
      ((filter.mine !== 'true' && filter.assigned !== 'me') || r.assigned_to === actorId) &&
      ((filter.unassigned !== 'true' && filter.assigned !== 'unassigned') || !r.assigned_to) &&
      (filter.overdue !== 'true' || isOverdue(String(r.status), r.due_at as Date)),
  );
  const start = filter.cursor ? filtered.findIndex((r) => r.id === filter.cursor) + 1 : 0;
  const limit = z.coerce.number().int().min(1).max(100).default(50).parse(filter.limit);
  return {
    items: filtered
      .slice(start, start + limit)
      .map((r) => ({ ...dto(r), overdue: isOverdue(String(r.status), r.due_at as Date) })),
    nextCursor: filtered.length > start + limit ? String(filtered[start + limit - 1].id) : null,
  };
}
export async function reviewDetail(id: string) {
  const db = await getDatabase();
  const [review] = await db.query('SELECT * FROM review_cases WHERE id=$1', [id]);
  if (!review) return failure('review_not_found', 'Review not found.', 404);
  const [order] = await db.query('SELECT * FROM orders WHERE id=$1', [review.order_id]);
  const [row] = await db.query(
    'SELECT snapshot FROM order_snapshots WHERE order_id=$1 AND version=$2',
    [review.order_id, review.snapshot_version],
  );
  const snapshot = orderSnapshotSchema.parse(row.snapshot);
  const origins =
    snapshot.measurements.source === '3dlook'
      ? await db.query(
          'SELECT source,created_at,canonical_dimensions FROM measurement_source_snapshots WHERE owner_id=$1 AND created_at <= $2 ORDER BY created_at DESC LIMIT 1',
          [order.owner, snapshot.measurements.updatedAt ?? snapshot.submittedAt],
        )
      : [];
  const origin = origins[0];
  return {
    review: { ...dto(review), overdue: isOverdue(String(review.status), review.due_at as Date) },
    snapshot,
    measurementSources: {
      source: snapshot.measurements.source,
      capturedAt: origin ? at(origin.created_at) : null,
      fields: snapshot.measurements.values.map((m) => ({
        id: m.id,
        source:
          origin && (origin.canonical_dimensions as Record<string, number>)[m.id] === m.mm
            ? '3dlook'
            : snapshot.measurements.source === 'customer'
              ? 'customer'
              : 'customer_or_unlinked_estimate',
      })),
    },
    currentSnapshotVersion: order.current_snapshot_version,
  };
}
export async function claimReview(id: string, actorId: string, input: unknown) {
  const data = z.strictObject({ rowVersion: z.number().int().positive() }).parse(input);
  await (
    await getDatabase()
  ).transaction(async (q) => {
    const { review: r, order: o } = await reviewFor(q, id);
    if (r.row_version !== data.rowVersion)
      return failure('version_conflict', 'The review changed. Reload it.');
    if (o.payment_status !== 'succeeded')
      return failure('order_state_invalid', 'Payment is not confirmed.');
    reviewTransition(r.status as ReviewStatus, 'in_review');
    await q(
      "UPDATE review_cases SET status='in_review',assigned_to=$2,row_version=row_version+1,updated_at=now() WHERE id=$1",
      [id, actorId],
    );
    await q(
      "UPDATE orders SET tailor_review_status='in_review',row_version=row_version+1 WHERE id=$1",
      [o.id],
    );
    await orderEvent(q, String(o.id), 'tailor_review_claimed', `user:${actorId}`, true);
    await writeAudit(q, {
      actor: `user:${actorId}`,
      action: 'review.claimed',
      entityType: 'review_cases',
      entityId: id,
      summary: { fields: ['status', 'assignedTo'] },
    });
  });
  return reviewDetail(id);
}
export async function decideReview(id: string, actorId: string, input: unknown) {
  const data = z
    .strictObject({
      rowVersion: z.number().int().positive(),
      snapshotVersion: z.number().int().positive().optional(),
      decision: z.enum(['no_changes', 'changes_proposed']),
      notes: z.string().max(2000).optional(),
      customerMessage: z.string().trim().max(1500).optional(),
      proposedMeasurements: z
        .record(z.string(), z.number().finite().positive().max(3000))
        .optional(),
      measurementsVerified: z.boolean().optional(),
    })
    .parse(input);
  await (
    await getDatabase()
  ).transaction(async (q) => {
    const { review: r, order: o } = await reviewFor(q, id);
    if (
      r.row_version !== data.rowVersion ||
      (data.snapshotVersion !== undefined && r.snapshot_version !== data.snapshotVersion) ||
      o.current_snapshot_version !== r.snapshot_version
    )
      return failure('version_conflict', 'This review changed. Reload before deciding.');
    if (r.assigned_to !== actorId)
      return failure('permission_denied', 'Only the assigned tailor can decide this review.', 403);
    const target = data.decision === 'no_changes' ? 'completed' : 'awaiting_customer';
    reviewTransition(r.status as ReviewStatus, target);
    const snapshot = await storedSnapshot(q, o),
      changes = data.proposedMeasurements ?? {};
    if (
      data.decision === 'changes_proposed' &&
      (!data.customerMessage ||
        !Object.keys(changes).length ||
        Object.keys(changes).some(
          (key) => !snapshot.measurements.values.some((m) => m.id === key),
        ) ||
        data.measurementsVerified)
    )
      return failure(
        'validation_failed',
        'Supply a customer message and valid measurement changes. Verification applies only to no changes.',
        422,
      );
    if (data.decision === 'no_changes' && Object.keys(changes).length)
      return failure(
        'validation_failed',
        'Choose Propose measurement changes to change values.',
        422,
      );
    await q(
      'UPDATE review_cases SET status=$2,decision=$3,proposed_measurements=$4,customer_message=$5,decision_notes=$6,decided_by=$7,decided_at=now(),measurements_verified_by=$8,measurements_verified_at=CASE WHEN $8::text IS NULL THEN NULL ELSE now() END,row_version=row_version+1,updated_at=now() WHERE id=$1',
      [
        id,
        target,
        data.decision,
        JSON.stringify(changes),
        data.customerMessage ?? null,
        data.notes ?? null,
        actorId,
        data.measurementsVerified ? actorId : null,
      ],
    );
    await q('UPDATE orders SET tailor_review_status=$2,row_version=row_version+1 WHERE id=$1', [
      o.id,
      target,
    ]);
    await orderEvent(q, String(o.id), 'tailor_review_decided', `user:${actorId}`, true, {
      decision: data.decision,
    });
    await enqueueNotification(
      q,
      o,
      target === 'completed' ? 'tailor_review_completed' : 'tailor_review_needs_input',
      id,
    );
    await writeAudit(q, {
      actor: `user:${actorId}`,
      action: 'review.decided',
      entityType: 'review_cases',
      entityId: id,
      summary: { fields: ['decision', 'status'] },
    });
  });
  return reviewDetail(id);
}
export async function respondToReview(owner: string, number: string, input: unknown) {
  const data = actionInput
    .extend({ response: z.enum(['accept_changes', 'keep_original']) })
    .parse(input);
  await (
    await getDatabase()
  ).transaction(async (q) => {
    const action = await orderAction(q, owner, data.actionId, 'respond', data, number);
    if (action.replay) return;
    const order = await lockedOrder(q, number, owner),
      [review] = await q(
        "SELECT * FROM review_cases WHERE order_id=$1 AND status='awaiting_customer' FOR UPDATE",
        [order.id],
      );
    if (
      !review ||
      order.payment_status !== 'succeeded' ||
      review.snapshot_version !== order.current_snapshot_version
    )
      return failure('order_state_invalid', 'This order is not awaiting your answer.');
    reviewTransition('awaiting_customer', 'completed');
    let nextVersion: number | null = null;
    if (data.response === 'accept_changes') {
      const prior = await storedSnapshot(q, order),
        proposed = review.proposed_measurements as Record<string, number>,
        acceptedAt = new Date().toISOString();
      nextVersion = prior.version + 1;
      const snapshot = orderSnapshotSchema.parse({
        ...prior,
        version: nextVersion,
        kind: 'amendment',
        measurements: {
          ...prior.measurements,
          version: prior.measurements.version + 1,
          updatedAt: acceptedAt,
          values: prior.measurements.values.map((m) => ({ ...m, mm: proposed[m.id] ?? m.mm })),
        },
        amendment: {
          reason: 'tailor_review',
          reviewCaseId: review.id,
          previousVersion: prior.version,
          acceptedAt,
          changedMeasurements: prior.measurements.values
            .filter((m) => proposed[m.id] !== undefined && m.mm !== proposed[m.id])
            .map((m) => ({ id: m.id, label: m.label, fromMm: m.mm, toMm: proposed[m.id] })),
        },
      });
      await q(
        "INSERT INTO order_snapshots(order_id,version,kind,snapshot,checksum,quote_id,action_id,created_by) VALUES($1,$2,'amendment',$3,$4,$5,$6,$7)",
        [
          order.id,
          nextVersion,
          JSON.stringify(snapshot),
          checksum(snapshot),
          order.quote_id,
          data.actionId,
          owner,
        ],
      );
      await orderEvent(q, String(order.id), 'order_amended', owner, true, { version: nextVersion });
    }
    await q(
      "UPDATE review_cases SET status='completed',customer_response=$2,customer_responded_at=now(),amendment_snapshot_version=$3,row_version=row_version+1,updated_at=now() WHERE id=$1",
      [
        review.id,
        data.response === 'accept_changes' ? 'accepted_changes' : 'kept_original',
        nextVersion,
      ],
    );
    await q(
      "UPDATE orders SET tailor_review_status='completed',current_snapshot_version=COALESCE($2,current_snapshot_version),row_version=row_version+1,updated_at=now() WHERE id=$1",
      [order.id, nextVersion],
    );
    await orderEvent(q, String(order.id), 'tailor_review_customer_responded', owner, true, {
      actionId: data.actionId,
      fingerprint: action.fingerprint,
      response: data.response,
    });
    await enqueueNotification(q, order, 'tailor_review_completed', String(review.id));
  });
}
