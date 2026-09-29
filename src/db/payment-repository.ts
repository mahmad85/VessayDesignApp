import { getDatabase, type Query } from './client';
import {
  actionInput,
  lockedOrder,
  storedSnapshot,
  orderEvent,
  openOnPayment,
  enqueueNotification,
} from './order-repository';
import { PUBLISH_LOCK } from './release-repository';
import { isSelectable } from '@/modules/catalog/garment';
import { DomainError } from '@/modules/configuration/types';
import {
  paymentProvider,
  paymentMode,
  parseStripeEvent,
} from '@/integrations/payments/stripe-orders';
import type { CheckoutInput, PaymentEvent } from '@/integrations/payments/types';
import type { Row } from './admin-mutations';
import { isPaymentTestRuntime } from '@/integrations/payments/test-runtime';
const fail = (code: string, message: string, status = 409): never => {
  throw new DomainError(code, message, status);
};
async function anomaly(q: Query, order: Row, event: PaymentEvent) {
  await q(
    'UPDATE orders SET needs_attention=true,row_version=row_version+1,updated_at=now() WHERE id=$1',
    [order.id],
  );
  await orderEvent(q, String(order.id), 'payment_anomaly', 'system:payment', false, {
    eventId: event.id,
    reason: 'payment_binding_mismatch',
  });
}
async function reconcile(q: Query, payment: Row, order: Row, event: PaymentEvent) {
  const m = event.metadata;
  if (
    m.orderId !== order.id ||
    m.paymentId !== payment.id ||
    m.snapshotVersion !== String(payment.snapshot_version) ||
    (event.type !== 'refunded' && event.sessionId !== payment.provider_session_id) ||
    (event.type === 'refunded' && event.paymentIntentId !== payment.provider_payment_intent_id) ||
    event.amountTotalMinor !== Number(payment.amount_minor) ||
    event.currency !== String(payment.currency).toUpperCase() ||
    event.livemode !== payment.livemode ||
    (!['succeeded', 'refunded', 'refund_pending'].includes(String(payment.status)) &&
      payment.snapshot_version !== order.current_snapshot_version)
  ) {
    await anomaly(q, order, event);
    return;
  }
  let status: string | null = null;
  if (event.type === 'refunded' && payment.status === 'succeeded') status = 'refunded';
  else if (
    event.type === 'async_succeeded' ||
    (event.type === 'session_completed' && event.paymentStatus === 'paid')
  ) {
    if (['succeeded', 'refunded', 'refund_pending'].includes(String(payment.status))) return;
    status = 'succeeded';
  } else if (payment.status === 'payment_pending') {
    if (event.type === 'async_failed') status = 'failed';
    if (event.type === 'session_expired') status = 'cancelled';
  }
  if (!status) return;
  if (status === 'succeeded') {
    const paid = await q(
      "SELECT id FROM payments WHERE order_id=$1 AND id<>$2 AND status IN ('succeeded','refunded','refund_pending')",
      [order.id, payment.id],
    );
    if (paid.length || order.fulfillment_status === 'cancelled') {
      await anomaly(q, order, event);
      return;
    }
  }
  await q(
    'UPDATE payments SET status=$2,provider_payment_intent_id=COALESCE($3,provider_payment_intent_id),row_version=row_version+1,updated_at=now() WHERE id=$1',
    [payment.id, status, event.paymentIntentId],
  );
  await q(
    'UPDATE orders SET payment_status=$2,shipping_address=COALESCE($3,shipping_address),row_version=row_version+1,updated_at=now() WHERE id=$1',
    [
      order.id,
      status,
      status === 'succeeded' && event.shipping ? JSON.stringify(event.shipping) : null,
    ],
  );
  await orderEvent(q, String(order.id), `payment_${status}`, 'system:payment', true, {
    paymentId: payment.id,
    eventId: event.id,
  });
  if (status === 'succeeded') {
    await openOnPayment(q, order);
    await enqueueNotification(q, order, 'payment_received', String(payment.id));
  }
  if (status === 'failed')
    await enqueueNotification(q, order, 'payment_failed', String(payment.id));
}
export async function receivePaymentEvent(
  event: PaymentEvent,
  provider: 'stripe' | 'fake' = 'stripe',
) {
  if (event.livemode !== paymentMode())
    return fail('livemode_mismatch', 'Payment event environment mismatch.', 400);
  if (event.type === 'ignored') return;
  // Stripe Charge metadata does not inherit PaymentIntent metadata. Full refunds
  // bind through the intent that was recorded by a verified paid session.
  if (event.type === 'refunded' && !event.metadata.kind && event.paymentIntentId) {
    const [bound] = await (
      await getDatabase()
    ).query(
      'SELECT id,order_id,snapshot_version FROM payments WHERE provider_payment_intent_id=$1 AND provider=$2',
      [event.paymentIntentId, provider],
    );
    if (!bound) return;
    event = {
      ...event,
      metadata: {
        kind: 'garment_order',
        paymentId: String(bound.id),
        orderId: String(bound.order_id),
        snapshotVersion: String(bound.snapshot_version),
      },
    };
  }
  if (event.metadata.kind !== 'garment_order') return;
  await (
    await getDatabase()
  ).transaction(async (q) => {
    const rows = await q(
      'INSERT INTO stripe_webhook_events(id,event_type) VALUES($1,$2) ON CONFLICT(id) DO NOTHING RETURNING id',
      [event.id, event.type],
    );
    if (!rows.length) return;
    const [initial] = await q('SELECT * FROM payments WHERE id=$1', [
      event.metadata.paymentId ?? '',
    ]);
    if (!initial) return; // No payment exists to bind; never create state from a webhook.
    const [order] = await q('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [initial.order_id]);
    const [payment] = await q('SELECT * FROM payments WHERE id=$1 FOR UPDATE', [initial.id]);
    if (payment.provider !== provider) {
      await anomaly(q, order, event);
      return;
    }
    // A webhook can arrive between provider creation and saving its session ID.
    if (!payment.provider_session_id) {
      throw new DomainError(
        'payment_pending',
        'Checkout binding is being saved. Retry this event.',
        503,
      );
    }
    await reconcile(q, payment, order, event);
  });
}
export async function paymentWebhook(raw: string, signature: string) {
  // Verification needs the endpoint secret, not a checkout key.
  const provider =
    process.env.PAYMENT_PROVIDER === 'fake' && isPaymentTestRuntime() ? 'fake' : 'stripe';
  const event =
    provider === 'fake'
      ? (await paymentProvider()).parseWebhook(raw, signature)
      : parseStripeEvent(raw, signature);
  await receivePaymentEvent(event, provider);
}
export async function checkoutOrder(owner: string, number: string, input: unknown, retry = 0) {
  const { actionId } = actionInput.parse(input),
    db = await getDatabase();
  // Hide non-owner orders before evaluating provider configuration.
  const [visible] = await db.query('SELECT id FROM orders WHERE number=$1 AND owner=$2', [
    number,
    owner,
  ]);
  if (!visible) return fail('order_not_found', 'Order not found.', 404);
  const provider = await paymentProvider();
  const reservation = await db.transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock($1)', [PUBLISH_LOCK]);
    const order = await lockedOrder(q, number, owner);
    const [priorAction] = await q('SELECT * FROM payments WHERE checkout_action_id=$1', [actionId]);
    if (priorAction && priorAction.order_id !== order.id)
      return fail('action_conflict', 'This checkout action belongs to another order.');
    if (
      order.fulfillment_status === 'cancelled' ||
      !['checkout_ready', 'failed', 'cancelled', 'payment_pending'].includes(
        String(order.payment_status),
      )
    )
      return fail('order_state_invalid', 'This order cannot start a payment.');
    const snapshot = await storedSnapshot(q, order);
    if (snapshot.kind !== 'submitted' || !snapshot.signoff.design || !snapshot.signoff.measurements)
      return fail('order_state_invalid', 'This snapshot is not signed off.');
    const [pending] = await q(
      "SELECT * FROM payments WHERE order_id=$1 AND status='payment_pending' FOR UPDATE",
      [order.id],
    );
    const expired = new Date(snapshot.totals.expiresAt).getTime() <= Date.now();
    if (expired && !pending) return fail('quote_expired', 'Price expired — update your order.');
    const availability = await q('SELECT code,availability FROM materials WHERE code=ANY($1)', [
      snapshot.items.map((i) => i.material.code),
    ]);
    const available = snapshot.items.every((i) => {
      const material = availability.find((m) => m.code === i.material.code);
      return !!material && isSelectable(material.availability as never);
    });
    if (!available && !pending)
      return fail('material_unavailable', 'A fabric is no longer available. Update your order.');
    if (process.env.NODE_ENV === 'production' && snapshot.catalogReferenceOnly)
      return fail('catalog_not_orderable', 'Reference data cannot be purchased in production.');
    let payment = pending;
    if (!payment) {
      if (priorAction)
        return fail(
          'action_conflict',
          'This checkout attempt has ended. Start a new payment action.',
        );
      if (Number(order.total_minor) <= 0)
        return fail('quote_unavailable', 'The order total must be positive.');
      [payment] = await q(
        "INSERT INTO payments(id,order_id,provider,snapshot_version,quote_id,amount_minor,shipping_minor,currency,status,livemode,checkout_action_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'payment_pending',$9,$10) RETURNING *",
        [
          crypto.randomUUID(),
          order.id,
          provider.name,
          order.current_snapshot_version,
          order.quote_id,
          order.total_minor,
          order.shipping_minor,
          order.currency,
          paymentMode(),
          actionId,
        ],
      );
      await q(
        "UPDATE orders SET payment_status='payment_pending',row_version=row_version+1,updated_at=now() WHERE id=$1",
        [order.id],
      );
      await orderEvent(q, String(order.id), 'payment_started', owner, true, {
        paymentId: payment.id,
      });
    }
    if (payment.provider !== provider.name)
      return fail(
        'payment_pending',
        'Restore the original payment provider to reconcile this attempt.',
      );
    const [commerce] = await q("SELECT ship_countries FROM commerce_settings WHERE id='default'");
    const app = process.env.APP_URL ?? 'http://localhost:3000';
    const request: CheckoutInput = {
      paymentId: String(payment.id),
      orderId: String(order.id),
      number,
      snapshotVersion: Number(payment.snapshot_version),
      currency: String(order.currency),
      items: snapshot.items.map((i) => ({
        name: `${i.product.name} — ${i.template?.name ?? 'Custom'}`,
        description: i.material.name,
        quantity: i.quantity,
        unitMinor: i.quote.unitMinor,
      })),
      shippingMinor: Number(order.shipping_minor),
      shipCountries: commerce.ship_countries as string[],
      customerEmail: snapshot.customer.email,
      successUrl: `${app}/orders/${number}?checkout=returned`,
      cancelUrl: `${app}/orders/${number}?checkout=cancelled`,
    };
    return { payment, request, expired, available };
  });
  let id = reservation.payment.provider_session_id as string | null;
  if (!id) {
    if (Date.now() - new Date(String(reservation.payment.created_at)).getTime() > 23 * 3600_000)
      return fail('payment_pending', 'This payment requires reconciliation before retrying.');
    // The durable row commits before this call. Retries use the same provider key.
    const created = await provider.createCheckout(reservation.request);
    id = created.sessionId;
    if (created.livemode !== paymentMode())
      return fail(
        'payment_pending',
        'Payment environment mismatch. Do not retry with a new payment.',
      );
    await db.query(
      'UPDATE payments SET provider_session_id=$2 WHERE id=$1 AND provider_session_id IS NULL',
      [reservation.payment.id, id],
    );
  }
  const session = await provider.retrieveCheckout(id);
  if (session.status === 'open') {
    const p = reservation.payment,
      m = session.metadata;
    if (
      session.livemode !== p.livemode ||
      session.amountTotalMinor !== Number(p.amount_minor) ||
      session.currency !== p.currency ||
      m.paymentId !== p.id ||
      m.orderId !== p.order_id ||
      m.snapshotVersion !== String(p.snapshot_version)
    )
      return fail('payment_pending', 'The checkout binding needs verification.');
    if (reservation.expired || !reservation.available) {
      await provider.expireCheckout(id);
      await receivePaymentEvent(
        { ...session, id: `reconcile-expired:${id}`, type: 'session_expired' },
        provider.name,
      );
      return fail(
        reservation.expired ? 'quote_expired' : 'material_unavailable',
        reservation.expired
          ? 'Price expired — update your order.'
          : 'A fabric is no longer available. Update your order.',
      );
    }
    if (!session.url) return fail('payment_pending', 'Checkout is being confirmed.');
    return { checkoutUrl: session.url };
  }
  await receivePaymentEvent(
    {
      ...session,
      id: `reconcile:${id}:${session.status}:${session.paymentStatus}`,
      type: session.status === 'expired' ? 'session_expired' : 'session_completed',
    },
    provider.name,
  );
  if (session.status === 'expired') {
    if (retry > 0) return fail('payment_pending', 'Checkout expired. Retry from your order.');
    return checkoutOrder(owner, number, { actionId: crypto.randomUUID() }, retry + 1);
  }
  return fail(
    'payment_pending',
    'We are confirming your payment. Open your order for the latest status.',
  );
}
