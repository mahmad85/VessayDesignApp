import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { DomainError } from '@/modules/configuration/types';
import type { CheckoutState, PaymentEvent, PaymentProvider } from './types';
import { isPaymentTestRuntime } from './test-runtime';

export const paymentMode = () =>
  process.env.NODE_ENV === 'production' && process.env.PAYMENTS_LIVE_ENABLED === 'true';
export function stripePaymentGuard() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (
    !key ||
    (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) ||
    (key.startsWith('sk_live_') && !paymentMode()) ||
    (process.env.NODE_ENV === 'production' && !paymentMode())
  )
    throw new DomainError(
      'payments_disabled',
      'Online payment is not available yet. Your order is saved.',
      503,
    );
  // A configured live production environment must use a live key; staging stays test mode.
  if (paymentMode() && !key.startsWith('sk_live_'))
    throw new DomainError(
      'payments_disabled',
      'The payment environment is not configured consistently.',
      503,
    );
}
function state(s: Stripe.Checkout.Session): CheckoutState {
  return {
    sessionId: s.id,
    status: s.status === 'complete' ? 'complete' : s.status === 'expired' ? 'expired' : 'open',
    url: s.url,
    paymentStatus: s.payment_status,
    amountTotalMinor: s.amount_total,
    currency: s.currency?.toUpperCase() ?? null,
    paymentIntentId:
      typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null),
    livemode: s.livemode,
    metadata: s.metadata ?? {},
    shipping: s.collected_information?.shipping_details ?? null,
  };
}
export function parseStripeEvent(raw: string, signature: string): PaymentEvent {
  const secret = process.env.STRIPE_ORDER_WEBHOOK_SECRET;
  if (!secret)
    throw new DomainError('payments_disabled', 'The order webhook is not configured.', 503);
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    throw new DomainError('invalid_signature', 'Invalid payment signature.', 400);
  }
  const types: Record<string, PaymentEvent['type']> = {
    'checkout.session.completed': 'session_completed',
    'checkout.session.async_payment_succeeded': 'async_succeeded',
    'checkout.session.async_payment_failed': 'async_failed',
    'checkout.session.expired': 'session_expired',
    'charge.refunded': 'refunded',
  };
  const type = types[event.type] ?? 'ignored';
  if (type === 'refunded') {
    const c = event.data.object as Stripe.Charge;
    return {
      id: event.id,
      type: c.refunded && c.amount_refunded === c.amount ? 'refunded' : 'ignored',
      livemode: event.livemode,
      sessionId: null,
      paymentIntentId:
        typeof c.payment_intent === 'string' ? c.payment_intent : (c.payment_intent?.id ?? null),
      paymentStatus: null,
      amountTotalMinor: c.amount,
      currency: c.currency.toUpperCase(),
      metadata: c.metadata ?? {},
      shipping: null,
    };
  }
  if (type === 'ignored')
    return {
      id: event.id,
      type,
      livemode: event.livemode,
      sessionId: null,
      paymentIntentId: null,
      paymentStatus: null,
      amountTotalMinor: null,
      currency: null,
      metadata: {},
      shipping: null,
    };
  return {
    ...state(event.data.object as Stripe.Checkout.Session),
    id: event.id,
    type,
    livemode: event.livemode,
  };
}
export const stripeOrders: PaymentProvider = {
  name: 'stripe',
  async createCheckout(input) {
    stripePaymentGuard();
    const metadata = {
      kind: 'garment_order',
      orderId: input.orderId,
      paymentId: input.paymentId,
      snapshotVersion: String(input.snapshotVersion),
    };
    const session = await getStripe().checkout.sessions.create(
      {
        mode: 'payment',
        line_items: input.items.map((i) => ({
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: i.unitMinor,
            product_data: { name: i.name, description: i.description },
          },
          quantity: i.quantity,
        })),
        ...(input.shippingMinor > 0
          ? {
              shipping_options: [
                {
                  shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: {
                      amount: input.shippingMinor,
                      currency: input.currency.toLowerCase(),
                    },
                    display_name: 'Delivery',
                  },
                },
              ],
            }
          : {}),
        shipping_address_collection: {
          allowed_countries:
            input.shipCountries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
        },
        customer_email: input.customerEmail,
        client_reference_id: input.orderId,
        metadata,
        payment_intent_data: { metadata },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
      { idempotencyKey: input.paymentId, timeout: 20000, maxNetworkRetries: 0 },
    );
    if (!session.url || session.livemode !== paymentMode())
      throw new DomainError(
        'payment_pending',
        'Checkout is being confirmed. Please retry from your order.',
        409,
      );
    return { sessionId: session.id, url: session.url, livemode: session.livemode };
  },
  async retrieveCheckout(id) {
    stripePaymentGuard();
    return state(
      await getStripe().checkout.sessions.retrieve(
        id,
        {},
        { timeout: 20000, maxNetworkRetries: 0 },
      ),
    );
  },
  async expireCheckout(id) {
    stripePaymentGuard();
    await getStripe().checkout.sessions.expire(id, {}, { timeout: 20000, maxNetworkRetries: 0 });
  },
  parseWebhook: parseStripeEvent,
};
export async function paymentProvider(): Promise<PaymentProvider> {
  if (process.env.PAYMENT_PROVIDER === 'fake') {
    if (!isPaymentTestRuntime())
      throw new DomainError(
        'payments_disabled',
        'The test payment provider is unavailable in this environment.',
        503,
      );
    return (await import('./fake')).fakePayments;
  }
  stripePaymentGuard();
  return stripeOrders;
}
