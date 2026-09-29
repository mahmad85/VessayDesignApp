import { NextRequest, NextResponse } from 'next/server';
import { getStripe, stripeConfigured } from '@/lib/stripe';
import { getDatabase } from '@/db/client';
import { processScanServiceEventWithStore } from '@/lib/scan-service-policy';
export const runtime = 'nodejs';
// Garment orders use /api/payments/stripe/webhook and a separate secret.
// This endpoint only handles scan-service events, and today it never receives
// a real one either, because scan-service checkout never creates a Stripe
// PaymentIntent (see scan-service/checkout/route.ts).
export async function POST(request: NextRequest) {
  if (!stripeConfigured())
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret)
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }
  const expectedLive = process.env.NODE_ENV === 'production';
  if (event.livemode !== expectedLive)
    return NextResponse.json({ error: 'Webhook mode mismatch.' }, { status: 400 });
  const db = await getDatabase();
  try {
    await db.transaction(async (query) => {
      await processScanServiceEventWithStore(event, {
        claimEvent: async (eventId, eventType) => {
          const inserted = await query(
            'INSERT INTO stripe_webhook_events(id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',
            [eventId, eventType],
          );
          return inserted.length > 0;
        },
        getPayment: async (paymentId) => {
          const rows = await query<{
            id: number;
            owner_id: string;
            draft_id: string;
            revision: number;
            amount_cents: number;
            currency: string;
            stripe_payment_intent_id: string | null;
          }>('SELECT * FROM scan_service_payments WHERE id=$1', [paymentId]);
          const row = rows[0];
          return row
            ? {
                id: row.id,
                ownerId: row.owner_id,
                draftId: row.draft_id,
                revision: row.revision,
                amountCents: row.amount_cents,
                currency: row.currency,
                stripePaymentIntentId: row.stripe_payment_intent_id,
              }
            : undefined;
        },
        updatePayment: async (paymentId, status) => {
          await query('UPDATE scan_service_payments SET status=$1,updated_at=now() WHERE id=$2', [
            status,
            paymentId,
          ]);
        },
        grantPaidService: async (payment) => {
          const entitlement = await query<{ id: number }>(
            'INSERT INTO scan_entitlements(owner_id,payment_id,draft_id,revision) VALUES($1,$2,$3,$4) ON CONFLICT (payment_id) DO NOTHING RETURNING id',
            [payment.ownerId, payment.id, payment.draftId, payment.revision],
          );
          if (entitlement[0])
            await query(
              'INSERT INTO garment_credits(owner_id,payment_id,amount_cents,currency) VALUES($1,$2,$3,$4) ON CONFLICT (payment_id) DO NOTHING',
              [payment.ownerId, payment.id, payment.amountCents, payment.currency],
            );
        },
      });
    });
  } catch (error) {
    console.error(
      'Scan-service webhook rejected:',
      error instanceof Error ? error.message : 'unknown',
    );
    return NextResponse.json(
      { error: 'Webhook payment did not match stored state.' },
      { status: 409 },
    );
  }
  return NextResponse.json({ received: true });
}
