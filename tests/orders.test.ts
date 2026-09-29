import { beforeAll, afterEach, describe, it, expect, vi } from 'vitest';
import Stripe from 'stripe';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { createSyntheticUser } from './helpers/users';
import { publishE2ECatalog } from '../src/db/e2e-catalog';
import { getDraft, mutateDraft, loadEngineContext } from '../src/db/repository';
import {
  runOrderCheck,
  submitOrder,
  customerOrder,
  cancelOrder,
  claimReview,
  decideReview,
  respondToReview,
  recordOverdue,
  reviewDetail,
  reviewQueue,
} from '../src/db/order-repository';
import { checkoutOrder, paymentWebhook } from '../src/db/payment-repository';
import { stripePaymentGuard } from '../src/integrations/payments/stripe-orders';
import { fakePayments } from '../src/integrations/payments/fake';
import { validateSubmission } from '../src/modules/orders/submission';
import { reviewTransition, type ReviewStatus } from '../src/modules/orders/tailor-review';
import { quoteCart } from '../src/modules/pricing/quote';
import { requiredDefinitionsForProducts } from '../src/modules/measurements/definitions';
import { orderFindings } from '../src/modules/orders/check-policy';
import { dispatchNotifications } from '../src/modules/notifications/dispatch';
import * as mail from '../src/integrations/mail';
import { commerceSettings, saveCommerce } from '../src/db/pricing-admin-repository';
import type { CommandV2, DraftV2 } from '../src/modules/configuration/types';
const db = setupTestDatabase();
beforeAll(async () => {
  process.env.VESSY_E2E_HOOKS = 'true';
  await publishE2ECatalog('priced');
}, PGLITE_TIMEOUT);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function complete() {
  const user = await createSyntheticUser(),
    owner = 'user:' + user.userId;
  let draft = await getDraft(owner);
  const command = async (c: CommandV2) =>
    (draft = await mutateDraft(owner, {
      actionId: crypto.randomUUID(),
      expectedRevision: draft.revision,
      command: c,
    }));
  for (const productCode of ['suit', 'shirt']) {
    await command({ type: 'add_garment', productCode });
    await command({
      type: 'design',
      patch: { preferences: { occasion: 'wedding', climate: 'warm' } },
    });
    await command({ type: 'accept_design' });
  }
  await command({ type: 'set_quantity', garmentId: draft.activeGarmentId!, quantity: 2 });
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
  expect(draft.review?.status).toBe('passed');
  return { owner, user, draft };
}
async function payload(draft: DraftV2, tailorReview = true) {
  const quote = quoteCart((await loadEngineContext()).current, draft);
  return {
    actionId: crypto.randomUUID(),
    expectedRevision: draft.revision,
    checkId: draft.review!.id,
    signoff: { design: true, measurements: true, statementVersion: 'signoff-v1' },
    tailorReview,
    acceptTotal: { amountMinor: quote.totalMinor!, currency: quote.currency },
  };
}
function fakeMode() {
  vi.stubEnv('PAYMENT_PROVIDER', 'fake');
  vi.stubEnv('STRIPE_ORDER_WEBHOOK_SECRET', 'whsec_SYNTHETIC_orders_only');
}
async function signed(
  number: string,
  type = 'checkout.session.completed',
  extra: Record<string, unknown> = {},
  eventId = crypto.randomUUID(),
) {
  const [p] = await (
    await db()
  ).query(
    'SELECT p.* FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.number=$1 ORDER BY p.created_at DESC LIMIT 1',
    [number],
  );
  const object = {
    id: p.provider_session_id,
    object: 'checkout.session',
    status: 'complete',
    payment_status: 'paid',
    amount_total: p.amount_minor,
    currency: String(p.currency).toLowerCase(),
    payment_intent: 'pi_SYNTHETIC_' + p.id,
    metadata: {
      kind: 'garment_order',
      orderId: p.order_id,
      paymentId: p.id,
      snapshotVersion: String(p.snapshot_version),
    },
    ...extra,
  };
  const raw = JSON.stringify({
      id: eventId,
      object: 'event',
      type,
      livemode: false,
      data: { object },
    }),
    signature = Stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret: 'whsec_SYNTHETIC_orders_only',
    });
  await paymentWebhook(raw, signature);
  return { raw, signature, p };
}
describe('SYNTHETIC M5 order lifecycle', { timeout: PGLITE_TIMEOUT }, () => {
  it('persists the check idempotently, validates every submission gate, and invalidates checks on edit', async () => {
    const { owner, draft } = await complete(),
      context = await loadEngineContext(),
      input = await payload(draft);
    expect(quoteCart(context.current, draft).totalMinor).toBe(105700);
    const variants: [string, string, DraftV2, unknown, boolean?][] = [
      ['sign_in_required', 'guest:synthetic', draft, input],
      ['revision_conflict', owner, draft, { ...input, expectedRevision: 0 }],
      ['cart_empty', owner, { ...draft, garments: [] }, input],
      ['check_required', owner, { ...draft, review: null }, input],
      ['check_required', owner, draft, { ...input, checkId: 'wrong' }],
      [
        'signoff_required',
        owner,
        draft,
        { ...input, signoff: { ...input.signoff, measurements: false } },
      ],
      [
        'signoff_required',
        owner,
        draft,
        { ...input, signoff: { ...input.signoff, statementVersion: 'old' } },
      ],
      [
        'catalog_update_required',
        owner,
        {
          ...draft,
          garments: draft.garments.map((g) => ({ ...g, catalogVersion: g.catalogVersion - 1 })),
        },
        input,
      ],
      [
        'quote_changed',
        owner,
        draft,
        { ...input, acceptTotal: { ...input.acceptTotal, amountMinor: 1 } },
      ],
      ['catalog_not_orderable', owner, draft, input, true],
      ['invalid_input', owner, draft, { ...input, tailorReview: 'yes' }],
    ];
    for (const [code, who, d, i, production] of variants) {
      try {
        validateSubmission(who, d, context, i as never, production ?? false);
        throw new Error('Expected ' + code);
      } catch (e) {
        expect(e, code).toMatchObject({ code });
      }
    }
    expect(() =>
      validateSubmission(
        owner,
        draft,
        { ...context, availability: { [draft.garments[0].materialCode]: 'out_of_stock' } },
        input,
      ),
    ).toThrow();
    const unpriced = structuredClone(context.current.catalog);
    for (const p of unpriced.products) p.bandPrices = {};
    const { indexCatalog } = await import('../src/modules/catalog/snapshot');
    expect(() =>
      validateSubmission(owner, draft, { ...context, current: indexCatalog(unpriced) }, input),
    ).toThrow('Every garment needs a price');
    const checkInput = { actionId: crypto.randomUUID(), expectedRevision: draft.revision };
    const first = await runOrderCheck(owner, checkInput);
    expect(await runOrderCheck(owner, checkInput)).toEqual(first);
    expect(
      first.review?.findings.some((f) => f.id === 'manual_measurements' && f.severity === 'advice'),
    ).toBe(true);
    const edited = await mutateDraft(owner, {
      actionId: crypto.randomUUID(),
      expectedRevision: draft.revision,
      command: { type: 'set_quantity', garmentId: draft.activeGarmentId!, quantity: 1 },
    });
    expect(edited.review).toBeNull();
    await expect(submitOrder(owner, input)).rejects.toMatchObject({ code: 'revision_conflict' });
    const blocked = orderFindings(
      { ...draft, measurements: { ...draft.measurements, values: {}, confirmed: false } },
      context,
    );
    expect(blocked.some((f) => f.target === 'measurements' && f.severity === 'blocker')).toBe(true);
  });
  it('double submission creates one immutable order; resubmit preserves prior rows and currency locks after an order', async () => {
    const { owner, draft } = await complete(),
      input = await payload(draft);
    const results = await Promise.all([submitOrder(owner, input), submitOrder(owner, input)]);
    expect(results[0].number).toBe(results[1].number);
    expect(results.map((r) => r.replayed).sort()).toEqual([false, true]);
    await expect(submitOrder(owner, { ...input, tailorReview: false })).rejects.toMatchObject({
      code: 'action_conflict',
    });
    const number = results[0].number,
      connection = await db(),
      [o] = await connection.query('SELECT * FROM orders WHERE number=$1', [number]);
    const [original] = await connection.query('SELECT * FROM order_snapshots WHERE order_id=$1', [
      o.id,
    ]);
    const originalItems = await connection.query('SELECT * FROM order_items WHERE order_id=$1', [
      o.id,
    ]);
    expect(originalItems).toHaveLength(2);
    expect(JSON.stringify(originalItems.map((i) => i.spec))).not.toContain('measurements');
    expect((original.snapshot as Record<string, unknown>).signoff).toMatchObject({
      draftRevision: draft.revision,
      measurementVersion: draft.measurements.version,
      statementVersion: 'signoff-v1',
    });
    await expect(customerOrder('user:another', number)).rejects.toMatchObject({
      code: 'order_not_found',
    });
    await submitOrder(
      owner,
      { ...input, actionId: crypto.randomUUID(), tailorReview: false },
      number,
    );
    expect((await customerOrder(owner, number)).snapshotVersion).toBe(2);
    expect(
      (
        await connection.query('SELECT * FROM order_snapshots WHERE order_id=$1 AND version=1', [
          o.id,
        ])
      )[0],
    ).toEqual(original);
    expect(
      await connection.query(
        'SELECT * FROM order_items WHERE order_id=$1 AND snapshot_version=1 ORDER BY line_no',
        [o.id],
      ),
    ).toEqual(originalItems);
    expect(
      (await connection.query('SELECT status FROM review_cases WHERE order_id=$1', [o.id]))[0]
        .status,
    ).toBe('cancelled');
    const commerce = await commerceSettings();
    await expect(
      saveCommerce({ rowVersion: commerce.rowVersion, currency: 'GBP' }, 'system:test'),
    ).rejects.toMatchObject({ code: 'currency_locked' });
    const action = { actionId: crypto.randomUUID() };
    await cancelOrder(owner, number, action);
    await cancelOrder(owner, number, action);
    expect((await customerOrder(owner, number)).fulfillment.status).toBe('cancelled');
  });
  it('retains deterministic authority on advisory failure and rejects edits made while advice runs', async () => {
    const { owner, draft } = await complete();
    const checked = await runOrderCheck(
      owner,
      { actionId: crypto.randomUUID(), expectedRevision: draft.revision },
      async () => {
        throw new Error('SYNTHETIC unavailable');
      },
    );
    expect(checked.review).toMatchObject({ status: 'passed', aiAdvisory: 'unavailable' });
    let begin!: () => void;
    const started = new Promise<void>((resolve) => {
      begin = resolve;
    });
    let finish!: (value: unknown) => void;
    const pending = runOrderCheck(
      owner,
      { actionId: crypto.randomUUID(), expectedRevision: draft.revision },
      () => {
        begin();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    );
    const rejected = expect(pending).rejects.toMatchObject({ code: 'revision_conflict' });
    await started;
    await mutateDraft(owner, {
      actionId: crypto.randomUUID(),
      expectedRevision: draft.revision,
      command: { type: 'set_quantity', garmentId: draft.activeGarmentId!, quantity: 1 },
    });
    finish({ advice: [] });
    await rejected;
    expect((await getDraft(owner)).review).toBeNull();
  });
  it('enforces the complete tailor state table, including closed cases', () => {
    const allowed = new Set([
      'awaiting_payment:pending',
      'awaiting_payment:cancelled',
      'pending:in_review',
      'pending:cancelled',
      'in_review:completed',
      'in_review:awaiting_customer',
      'in_review:cancelled',
      'awaiting_customer:completed',
      'awaiting_customer:cancelled',
    ]);
    const states: ReviewStatus[] = [
      'awaiting_payment',
      'pending',
      'in_review',
      'awaiting_customer',
      'completed',
      'cancelled',
    ];
    for (const from of states)
      for (const to of states) {
        if (allowed.has(`${from}:${to}`)) expect(() => reviewTransition(from, to)).not.toThrow();
        else expect(() => reviewTransition(from, to)).toThrow();
      }
  });
  it('guards Stripe and reuses one payment, rejects forged/mismatched events, and opens a review once', async () => {
    for (const [env, key, live] of [
      ['development', '', ''],
      ['development', 'sk_live_SYNTHETIC', 'true'],
      ['production', 'sk_live_SYNTHETIC', 'false'],
    ] as const) {
      vi.stubEnv('NODE_ENV', env);
      vi.stubEnv('STRIPE_SECRET_KEY', key);
      vi.stubEnv('PAYMENTS_LIVE_ENABLED', live);
      expect(stripePaymentGuard).toThrow();
    }
    vi.unstubAllEnvs();
    fakeMode();
    const { owner, draft } = await complete(),
      { number } = await submitOrder(owner, await payload(draft));
    const calls = await Promise.all([
      checkoutOrder(owner, number, { actionId: crypto.randomUUID() }),
      checkoutOrder(owner, number, { actionId: crypto.randomUUID() }),
    ]);
    expect(calls[0]).toEqual(calls[1]);
    expect((await customerOrder(owner, number)).payment.status).toBe('payment_pending');
    await expect(
      cancelOrder(owner, number, { actionId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: 'order_state_invalid' });
    await expect(paymentWebhook('{}', 'forged')).rejects.toMatchObject({
      code: 'invalid_signature',
    });
    const bad = await signed(number, 'checkout.session.completed', { amount_total: 1 });
    expect((await customerOrder(owner, number)).payment.status).toBe('payment_pending');
    expect(
      (await (await db()).query('SELECT needs_attention FROM orders WHERE number=$1', [number]))[0]
        .needs_attention,
    ).toBe(true);
    const liveRaw = JSON.stringify({
      id: crypto.randomUUID(),
      type: 'checkout.session.completed',
      livemode: true,
      data: { object: { metadata: { kind: 'garment_order' } } },
    });
    await expect(
      paymentWebhook(
        liveRaw,
        Stripe.webhooks.generateTestHeaderString({
          payload: liveRaw,
          secret: 'whsec_SYNTHETIC_orders_only',
        }),
      ),
    ).rejects.toMatchObject({ code: 'livemode_mismatch' });
    const event = await signed(number);
    await paymentWebhook(event.raw, event.signature);
    await signed(number, 'checkout.session.expired', {
      payment_status: 'unpaid',
      status: 'expired',
    });
    const order = await customerOrder(owner, number);
    expect(order.payment.status).toBe('succeeded');
    expect(order.tailorReview.status).toBe('pending');
    expect(order.fulfillment.status).toBe('not_released');
    const timeline = order.timeline.map((e) => e.label);
    expect(timeline.indexOf('Payment received')).toBeLessThan(
      timeline.indexOf('Your tailor review started'),
    );
    expect(
      await (
        await db()
      ).query("SELECT * FROM notifications WHERE order_id=$1 AND purpose='payment_received'", [
        event.p.order_id,
      ]),
    ).toHaveLength(1);
    expect(
      await (
        await db()
      ).query("SELECT * FROM order_events WHERE order_id=$1 AND type='tailor_review_opened'", [
        event.p.order_id,
      ]),
    ).toHaveLength(1);
    await expect(
      submitOrder(owner, { ...(await payload(draft)), actionId: crypto.randomUUID() }, number),
    ).rejects.toMatchObject({ code: 'order_state_invalid' });
    expect(bad.p.id).toBe(event.p.id);
    // Charge refunds have no inherited Checkout/PaymentIntent metadata.
    const refund = JSON.stringify({
      id: 'evt_SYNTHETIC_refund_' + crypto.randomUUID(),
      type: 'charge.refunded',
      livemode: false,
      data: {
        object: {
          id: 'ch_SYNTHETIC',
          payment_intent: 'pi_SYNTHETIC_' + event.p.id,
          metadata: {},
          refunded: true,
          amount: event.p.amount_minor,
          amount_refunded: event.p.amount_minor,
          currency: String(event.p.currency).toLowerCase(),
        },
      },
    });
    await paymentWebhook(
      refund,
      Stripe.webhooks.generateTestHeaderString({
        payload: refund,
        secret: 'whsec_SYNTHETIC_orders_only',
      }),
    );
    expect((await customerOrder(owner, number)).payment.status).toBe('refunded');
  });
  it('handles async outcomes, expiration/retry, quote expiry and checkout without tailor approval', async () => {
    fakeMode();
    const { owner, draft } = await complete(),
      { number } = await submitOrder(owner, await payload(draft, false));
    await checkoutOrder(owner, number, { actionId: crypto.randomUUID() });
    await signed(number, 'checkout.session.completed', { payment_status: 'unpaid' });
    expect((await customerOrder(owner, number)).payment.status).toBe('payment_pending');
    await signed(number, 'checkout.session.async_payment_failed', { payment_status: 'unpaid' });
    expect((await customerOrder(owner, number)).payment.status).toBe('failed');
    await checkoutOrder(owner, number, { actionId: crypto.randomUUID() });
    await signed(number, 'checkout.session.async_payment_succeeded');
    expect((await customerOrder(owner, number)).tailorReview.status).toBe('not_requested');
    const next = await submitOrder(owner, await payload(draft, false));
    await checkoutOrder(owner, next.number, { actionId: crypto.randomUUID() });
    await signed(next.number, 'checkout.session.expired', {
      status: 'expired',
      payment_status: 'unpaid',
    });
    expect((await customerOrder(owner, next.number)).payment.status).toBe('cancelled');
    await checkoutOrder(owner, next.number, { actionId: crypto.randomUUID() });
    const expired = await submitOrder(owner, await payload(draft, false));
    await (
      await db()
    ).query(
      "UPDATE order_snapshots SET snapshot=jsonb_set(snapshot,'{totals,expiresAt}',to_jsonb('2020-01-01T00:00:00.000Z'::text)) WHERE order_id=(SELECT id FROM orders WHERE number=$1)",
      [expired.number],
    );
    await expect(
      checkoutOrder(owner, expired.number, { actionId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: 'quote_expired' });
  });
  it('records tailor amendments without touching item rows or the draft; keep and verified outcomes remain distinct', async () => {
    fakeMode();
    const { owner, user, draft } = await complete();
    for (const response of ['accept_changes', 'keep_original', 'no_changes'] as const) {
      const { number } = await submitOrder(owner, await payload(draft));
      await checkoutOrder(owner, number, { actionId: crypto.randomUUID() });
      const event = await signed(number);
      const [r] = await (
        await db()
      ).query('SELECT * FROM review_cases WHERE order_id=$1', [event.p.order_id]);
      const originalItems = await (
        await db()
      ).query('SELECT * FROM order_items WHERE order_id=$1', [event.p.order_id]);
      await (
        await db()
      ).query("UPDATE review_cases SET due_at=now()-interval '1 hour' WHERE id=$1", [r.id]);
      await (await db()).transaction((q) => recordOverdue(q, String(event.p.order_id)));
      await (await db()).transaction((q) => recordOverdue(q, String(event.p.order_id)));
      expect((await customerOrder(owner, number)).tailorReview.overdue).toBe(true);
      expect(
        await (
          await db()
        ).query(
          "SELECT id FROM notifications WHERE order_id=$1 AND purpose='tailor_review_delayed'",
          [event.p.order_id],
        ),
      ).toHaveLength(1);
      await claimReview(String(r.id), user.userId, { rowVersion: r.row_version });
      const detail = await reviewDetail(String(r.id));
      await expect(
        decideReview(String(r.id), user.userId, {
          rowVersion: (detail.review as Record<string, unknown>).rowVersion,
          decision: 'changes_proposed',
          proposedMeasurements: { bad: 900 },
          customerMessage: 'SYNTHETIC correction',
        }),
      ).rejects.toMatchObject({ code: 'validation_failed' });
      await decideReview(String(r.id), user.userId, {
        rowVersion: (detail.review as Record<string, unknown>).rowVersion,
        decision: response === 'no_changes' ? 'no_changes' : 'changes_proposed',
        ...(response === 'no_changes'
          ? { measurementsVerified: true }
          : { customerMessage: 'SYNTHETIC proposal', proposedMeasurements: { chest: 940 } }),
      });
      if (response !== 'no_changes') {
        const action = { actionId: crypto.randomUUID(), response };
        await respondToReview(owner, number, action);
        await respondToReview(owner, number, action);
      }
      const current = await customerOrder(owner, number);
      expect(current.tailorReview.status).toBe('completed');
      expect(current.snapshotVersion).toBe(response === 'accept_changes' ? 2 : 1);
      expect(current.measurements.values.find((m) => m.id === 'chest')!.mm).toBe(
        response === 'accept_changes' ? 940 : 900,
      );
      expect(current.tailorReview.verified).toBe(response === 'no_changes');
      expect(
        await (await db()).query('SELECT * FROM order_items WHERE order_id=$1', [event.p.order_id]),
      ).toEqual(originalItems);
      expect((await getDraft(owner)).measurements).toEqual(draft.measurements);
    }
    expect(() => reviewTransition('completed', 'pending')).toThrow();
    expect(() => reviewTransition('pending', 'completed')).toThrow();
    expect((await reviewQueue(user.userId, { mine: 'true' })).items).toEqual([]);
  });
  it('keeps payment state when delivery fails and excludes private data from the customer DTO', async () => {
    fakeMode();
    const { owner, draft } = await complete(),
      { number } = await submitOrder(owner, await payload(draft));
    await checkoutOrder(owner, number, { actionId: crypto.randomUUID() });
    const event = await signed(number);
    vi.spyOn(mail, 'sendOrderEmail').mockRejectedValue(new Error('SYNTHETIC delivery failure'));
    await dispatchNotifications(number);
    const order = await customerOrder(owner, number);
    expect(order.payment.status).toBe('succeeded');
    expect(
      (
        await (
          await db()
        ).query('SELECT status,attempts,payload FROM notifications WHERE order_id=$1', [
          event.p.order_id,
        ])
      )[0],
    ).toMatchObject({ status: 'failed', attempts: 1 });
    expect(JSON.stringify(order)).not.toMatch(
      /supplierId|supplierArticle|decisionNotes|customerEmail|payment_intent/,
    );
    // Provider errors preserve the durable pending row so a retry cannot create a second charge.
    const next = await submitOrder(owner, await payload(draft));
    const create = vi
      .spyOn(fakePayments, 'createCheckout')
      .mockRejectedValueOnce(new Error('SYNTHETIC timeout'));
    await expect(
      checkoutOrder(owner, next.number, { actionId: crypto.randomUUID() }),
    ).rejects.toThrow('timeout');
    await checkoutOrder(owner, next.number, { actionId: crypto.randomUUID() });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].paymentId).toBe(create.mock.calls[1][0].paymentId);
  });
  it('keeps accepted snapshots and item specifications unchanged after catalog publication', async () => {
    const { owner, draft } = await complete();
    const { number } = await submitOrder(owner, await payload(draft, false));
    const connection = await db();
    const sql =
      'SELECT s.* FROM order_snapshots s JOIN orders o ON o.id=s.order_id WHERE o.number=$1';
    const before = await connection.query(sql, [number]);
    const itemSql =
      'SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.number=$1';
    const items = await connection.query(itemSql, [number]);
    await publishE2ECatalog('priced');
    expect(await connection.query(sql, [number])).toEqual(before);
    expect(await connection.query(itemSql, [number])).toEqual(items);
    expect((await customerOrder(owner, number)).totalMinor).toBe(105700);
  });
});
