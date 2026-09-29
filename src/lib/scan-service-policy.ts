import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
// Paid single-use AI scan: a separate $5 service purchase, distinct from
// garment checkout (integrations/payments/stripe-orders.ts).
// This mirrors the vendor's own fail-closed posture: no Stripe charge is ever
// created until 3DLOOK supplies a private, single-use scan-authorization
// capability. See docs/integrations/3DLOOK.md, INT-002.
export const SCAN_SERVICE_FEE_CENTS = Number(process.env.SCAN_SERVICE_FEE_CENTS ?? 500);
export const SCAN_SERVICE_CURRENCY = 'usd';
export function scanServiceCustomerTerms(amountCents = SCAN_SERVICE_FEE_CENTS) {
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: SCAN_SERVICE_CURRENCY,
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
  return {
    amount,
    summary: `Pay ${amount} for one scan. Get ${amount} off your next eligible garment order. Your saved measurements stay available to reuse.`,
    noOrder:
      'If you do not place an eligible garment order, the scan remains a measurement service fee.',
    repeats: 'Repeat scans require another eligible permission.',
  };
}
export function providerScanAuthorizationReadiness() {
  const privateCredentialPresent = Boolean(process.env.SAIA_SCAN_AUTHORIZATION_API_KEY);
  return {
    ready: false,
    code: privateCredentialPresent
      ? 'single_use_authorization_adapter_not_implemented'
      : 'single_use_provider_authorization_not_configured',
    required:
      'A private 3DLOOK capability that mints an expiring, single-use customer scan authorization.',
  } as const;
}
export function scanCheckoutFingerprint(ownerId: string, draftId: string, revision: number) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        ownerId,
        draftId,
        revision,
        amountCents: SCAN_SERVICE_FEE_CENTS,
        currency: SCAN_SERVICE_CURRENCY,
      }),
    )
    .digest('hex');
}
export function scanServiceStripeTransition(event: Stripe.Event) {
  if (
    ![
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'payment_intent.canceled',
    ].includes(event.type)
  )
    return null;
  const intent = event.data.object as Stripe.PaymentIntent;
  if (intent.metadata?.vessyService !== 'measurement_scan') return null;
  const paymentId = Number(intent.metadata.scanServicePaymentId);
  if (!Number.isInteger(paymentId)) return null;
  return {
    paymentId,
    ownerId: intent.metadata.ownerId,
    intentId: intent.id,
    amountCents: intent.amount,
    currency: intent.currency,
    status:
      event.type === 'payment_intent.succeeded'
        ? ('paid' as const)
        : event.type === 'payment_intent.canceled'
          ? ('cancelled' as const)
          : ('payment_failed' as const),
    grantsAccess: event.type === 'payment_intent.succeeded',
  };
}
export type ScanServiceEventStore = {
  claimEvent: (eventId: string, eventType: string) => Promise<boolean>;
  getPayment: (paymentId: number) => Promise<
    | {
        id: number;
        ownerId: string;
        draftId: string;
        revision: number;
        amountCents: number;
        currency: string;
        stripePaymentIntentId: string | null;
      }
    | undefined
  >;
  updatePayment: (
    paymentId: number,
    status: 'paid' | 'payment_failed' | 'cancelled',
  ) => Promise<void>;
  grantPaidService: (payment: {
    id: number;
    ownerId: string;
    draftId: string;
    revision: number;
    amountCents: number;
    currency: string;
  }) => Promise<void>;
};
export async function processScanServiceEventWithStore(
  event: Stripe.Event,
  store: ScanServiceEventStore,
) {
  const transition = scanServiceStripeTransition(event);
  if (!transition) return false;
  const payment = await store.getPayment(transition.paymentId);
  if (
    !payment ||
    payment.ownerId !== transition.ownerId ||
    payment.amountCents !== transition.amountCents ||
    payment.currency.toLowerCase() !== transition.currency.toLowerCase() ||
    payment.stripePaymentIntentId !== transition.intentId
  )
    throw new Error(
      'Stripe scan-service payment does not match the stored Vessy service purchase.',
    );
  if (!(await store.claimEvent(event.id, event.type))) return true;
  await store.updatePayment(payment.id, transition.status);
  if (transition.grantsAccess) await store.grantPaidService(payment);
  return true;
}
export function creditAfterOrderPayment(
  current: 'available' | 'reserved' | 'consumed' | 'revoked',
  event: 'succeeded' | 'failed' | 'cancelled' | 'refunded',
) {
  if (event === 'succeeded' && current === 'reserved') return 'consumed';
  if ((event === 'failed' || event === 'cancelled') && current === 'reserved') return 'available';
  if (event === 'refunded') return 'revoked';
  return current;
}
