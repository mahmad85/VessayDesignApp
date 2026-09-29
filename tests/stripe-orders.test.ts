import { describe, it, expect, vi, afterEach } from 'vitest';
import { stripeOrders, parseStripeEvent } from '../src/integrations/payments/stripe-orders';
import { getStripe } from '../src/lib/stripe';
import Stripe from 'stripe';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('Stripe SDK contracts (synthetic fixtures; no network)', () => {
  it('uses the server price, quantity, shipping and a durable idempotency key', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_SYNTHETIC_contract');
    const stripe = getStripe();
    const create = vi.spyOn(stripe.checkout.sessions, 'create').mockResolvedValue({
      id: 'cs_test_SYNTHETIC',
      url: 'https://checkout.stripe.com/c/pay/cs_test_SYNTHETIC',
      livemode: false,
    } as never);
    await stripeOrders.createCheckout({
      paymentId: 'synthetic-payment',
      orderId: 'synthetic-order',
      number: 'VS-000001',
      snapshotVersion: 2,
      currency: 'USD',
      items: [
        { name: 'SYNTHETIC Shirt', description: 'SYNTHETIC cotton', unitMinor: 12900, quantity: 2 },
      ],
      shippingMinor: 1000,
      shipCountries: ['US'],
      customerEmail: 'synthetic@vessy.invalid',
      successUrl: 'http://localhost:3000/orders/VS-000001?checkout=returned',
      cancelUrl: 'http://localhost:3000/orders/VS-000001?checkout=cancelled',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: 12900,
              product_data: { name: 'SYNTHETIC Shirt', description: 'SYNTHETIC cotton' },
            },
            quantity: 2,
          },
        ],
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: { amount: 1000, currency: 'usd' },
              display_name: 'Delivery',
            },
          },
        ],
        metadata: {
          kind: 'garment_order',
          orderId: 'synthetic-order',
          paymentId: 'synthetic-payment',
          snapshotVersion: '2',
        },
        payment_intent_data: {
          metadata: {
            kind: 'garment_order',
            orderId: 'synthetic-order',
            paymentId: 'synthetic-payment',
            snapshotVersion: '2',
          },
        },
      }),
      { idempotencyKey: 'synthetic-payment', timeout: 20000, maxNetworkRetries: 0 },
    );
  });
  it('normalizes full refunds without confusing partial refunds or exposing provider payloads', () => {
    vi.stubEnv('STRIPE_ORDER_WEBHOOK_SECRET', 'whsec_SYNTHETIC_contract');
    const parse = (refunded: boolean, amount_refunded: number) => {
      const raw = JSON.stringify({
        id: 'evt_SYNTHETIC_refund',
        type: 'charge.refunded',
        livemode: false,
        data: {
          object: {
            id: 'ch_SYNTHETIC',
            payment_intent: 'pi_SYNTHETIC',
            amount: 1000,
            amount_refunded,
            refunded,
            currency: 'usd',
            metadata: {},
          },
        },
      });
      return parseStripeEvent(
        raw,
        Stripe.webhooks.generateTestHeaderString({
          payload: raw,
          secret: 'whsec_SYNTHETIC_contract',
        }),
      );
    };
    expect(parse(true, 1000)).toMatchObject({
      type: 'refunded',
      paymentIntentId: 'pi_SYNTHETIC',
      amountTotalMinor: 1000,
      currency: 'USD',
    });
    expect(parse(false, 500).type).toBe('ignored');
  });
});
