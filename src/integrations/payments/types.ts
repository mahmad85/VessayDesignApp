export type CheckoutInput = {
  paymentId: string;
  orderId: string;
  number: string;
  snapshotVersion: number;
  currency: string;
  items: { name: string; description: string; unitMinor: number; quantity: number }[];
  shippingMinor: number;
  shipCountries: string[];
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};
export type PaymentEvent = {
  id: string;
  type:
    | 'session_completed'
    | 'async_succeeded'
    | 'async_failed'
    | 'session_expired'
    | 'refunded'
    | 'ignored';
  livemode: boolean;
  sessionId: string | null;
  paymentIntentId: string | null;
  paymentStatus: string | null;
  amountTotalMinor: number | null;
  currency: string | null;
  metadata: Record<string, string>;
  shipping: unknown | null;
};
export type CheckoutState = Omit<PaymentEvent, 'type' | 'id'> & {
  status: 'open' | 'complete' | 'expired';
  url: string | null;
};
export interface PaymentProvider {
  name: 'stripe' | 'fake';
  createCheckout(
    input: CheckoutInput,
  ): Promise<{ sessionId: string; url: string; livemode: boolean }>;
  retrieveCheckout(sessionId: string): Promise<CheckoutState>;
  expireCheckout(sessionId: string): Promise<void>;
  parseWebhook(body: string, signature: string): PaymentEvent;
}
