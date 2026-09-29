import { DomainError } from '@/modules/configuration/types';
import { parseStripeEvent } from './stripe-orders';
import type { CheckoutState, PaymentProvider } from './types';
import { isPaymentTestRuntime } from './test-runtime';
if (process.env.NODE_ENV === 'production')
  throw new Error('Synthetic payment provider cannot run in production.');
const globalStore = globalThis as unknown as { syntheticPayments?: Map<string, CheckoutState> };
const sessions = (globalStore.syntheticPayments ??= new Map<string, CheckoutState>());
const guard = () => {
  if (!isPaymentTestRuntime())
    throw new DomainError('payments_disabled', 'Synthetic payment provider is test-only.', 503);
};
export const fakePayments: PaymentProvider = {
  name: 'fake',
  async createCheckout(input) {
    guard();
    const id = `cs_test_SYNTHETIC_${input.paymentId}`;
    let value = sessions.get(id);
    if (!value) {
      value = {
        sessionId: id,
        status: 'open',
        url: `/orders/${encodeURIComponent(input.number)}?checkout=returned&synthetic=true`,
        livemode: false,
        paymentStatus: 'unpaid',
        amountTotalMinor:
          input.items.reduce((s, i) => s + i.unitMinor * i.quantity, 0) + input.shippingMinor,
        currency: input.currency,
        paymentIntentId: null,
        shipping: null,
        metadata: {
          kind: 'garment_order',
          orderId: input.orderId,
          paymentId: input.paymentId,
          snapshotVersion: String(input.snapshotVersion),
        },
      };
      sessions.set(id, value);
    }
    return { sessionId: id, url: value.url!, livemode: false };
  },
  async retrieveCheckout(id) {
    guard();
    const s = sessions.get(id);
    if (!s)
      throw new DomainError(
        'payment_pending',
        'Synthetic session unavailable. Do not create another payment.',
        409,
      );
    return structuredClone(s);
  },
  async expireCheckout(id) {
    guard();
    const s = sessions.get(id);
    if (s?.status === 'open') s.status = 'expired';
  },
  parseWebhook(raw, signature) {
    guard();
    const event = parseStripeEvent(raw, signature);
    const s = event.sessionId ? sessions.get(event.sessionId) : null;
    if (s && event.amountTotalMinor === s.amountTotalMinor && event.currency === s.currency) {
      if (event.type === 'session_expired' && s.status === 'open') s.status = 'expired';
      if (['session_completed', 'async_succeeded'].includes(event.type)) {
        s.status = 'complete';
        s.paymentStatus = event.paymentStatus;
      }
    }
    return event;
  },
};
