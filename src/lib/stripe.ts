import Stripe from 'stripe';
const stripeGlobal = globalThis as unknown as { vessyStripe?: Stripe };
export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
export function getStripe() {
  if (!stripeConfigured()) throw new Error('Stripe is not configured.');
  if (!stripeGlobal.vessyStripe)
    stripeGlobal.vessyStripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return stripeGlobal.vessyStripe;
}
