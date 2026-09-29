import Stripe from 'stripe';
import { createSyntheticUser } from './users';
import { getDatabase } from '../../src/db/client';
import { getDraft, mutateDraft, loadEngineContext } from '../../src/db/repository';
import { runOrderCheck, submitOrder } from '../../src/db/order-repository';
import { checkoutOrder, paymentWebhook } from '../../src/db/payment-repository';
import { quoteCart } from '../../src/modules/pricing/quote';
import { requiredDefinitionsForProducts } from '../../src/modules/measurements/definitions';
import type { CommandV2 } from '../../src/modules/configuration/types';
export async function syntheticOrder({ review = false, paid = true } = {}) {
  const user = await createSyntheticUser(),
    owner = 'user:' + user.userId;
  let draft = await getDraft(owner);
  const command = async (command: CommandV2) =>
    (draft = await mutateDraft(owner, {
      actionId: crypto.randomUUID(),
      expectedRevision: draft.revision,
      command,
    }));
  for (const productCode of ['suit', 'shirt']) {
    await command({ type: 'add_garment', productCode });
    await command({
      type: 'design',
      patch: { preferences: { occasion: 'wedding', climate: 'warm' } },
    });
    await command({ type: 'accept_design' });
  }
  await command({
    type: 'measurements',
    confirm: true,
    values: Object.fromEntries(
      requiredDefinitionsForProducts(['suit', 'shirt']).map((m) => [
        m.id,
        m.id === 'height' ? 1800 : 900,
      ]),
    ),
  });
  draft = await runOrderCheck(owner, {
    actionId: crypto.randomUUID(),
    expectedRevision: draft.revision,
  });
  const quote = quoteCart((await loadEngineContext()).current, draft);
  const submitted = await submitOrder(owner, {
    actionId: crypto.randomUUID(),
    expectedRevision: draft.revision,
    checkId: draft.review!.id,
    signoff: { design: true, measurements: true, statementVersion: 'signoff-v1' },
    tailorReview: review,
    acceptTotal: { amountMinor: quote.totalMinor, currency: quote.currency },
  });
  const [stored] = await (
    await getDatabase()
  ).query('SELECT id FROM orders WHERE number=$1', [submitted.number]);
  const order = { ...submitted, id: String(stored.id) };
  if (paid) {
    await checkoutOrder(owner, order.number, { actionId: crypto.randomUUID() });
    const [p] = await (
      await getDatabase()
    ).query('SELECT * FROM payments WHERE order_id=$1', [order.id]);
    const raw = JSON.stringify({
      id: crypto.randomUUID(),
      object: 'event',
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: p.provider_session_id,
          object: 'checkout.session',
          status: 'complete',
          payment_status: 'paid',
          amount_total: p.amount_minor,
          currency: String(p.currency).toLowerCase(),
          metadata: {
            kind: 'garment_order',
            orderId: order.id,
            paymentId: p.id,
            snapshotVersion: String(p.snapshot_version),
          },
        },
      },
    });
    await paymentWebhook(
      raw,
      Stripe.webhooks.generateTestHeaderString({
        payload: raw,
        secret: 'whsec_SYNTHETIC_orders_only',
      }),
    );
  }
  return { order, user, owner, draft };
}
