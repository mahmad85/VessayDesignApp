import { beforeAll, afterEach, describe, it, expect, vi } from 'vitest';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { syntheticOrder } from './helpers/orders';
import { publishE2ECatalog } from '../src/db/e2e-catalog';
import {
  allowedTransitions,
  assertTransition,
  derivedStatus,
  fulfillmentStates,
  opsToday,
  supplierOverdue,
  trackingInput,
  type FulfillmentState,
} from '../src/modules/orders/fulfillment';
import {
  adminOrder,
  adminOrders,
  adminSnapshot,
  assignOrder,
  transitionOrderItem,
  releaseOrder,
  productionSheet,
  supplierItems,
  updateOrderMeta,
  addOrderNote,
  retryNotification,
} from '../src/db/fulfillment-repository';
import { saveSupplier } from '../src/db/supplier-repository';
import {
  customerOrder,
  claimReview,
  decideReview,
  respondToReview,
} from '../src/db/order-repository';
import { ROLE_PERMISSIONS } from '../src/modules/staff/permissions';
import {
  findCustomers,
  supportCustomer,
  operationsDashboard,
} from '../src/db/operations-repository';
import { productionSheetHtml } from '../src/modules/orders/production-sheet';
import { dispatchNotifications } from '../src/modules/notifications/dispatch';
import * as mail from '../src/integrations/mail';
const db = setupTestDatabase(),
  actor = 'system:synthetic_fulfillment',
  permissions = ROLE_PERMISSIONS.owner;
beforeAll(async () => {
  process.env.VESSY_E2E_HOOKS = 'true';
  process.env.PAYMENT_PROVIDER = 'fake';
  process.env.STRIPE_ORDER_WEBHOOK_SECRET = 'whsec_SYNTHETIC_orders_only';
  await publishE2ECatalog('priced');
}, PGLITE_TIMEOUT);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const supplier = () =>
  saveSupplier(
    null,
    {
      code: 'synthetic-' + crypto.randomUUID(),
      name: 'SYNTHETIC Manufacturer',
      kind: 'manufacturer',
      status: 'active',
      addressLine1: 'SYNTHETIC address',
      city: 'Test city',
      countryCode: 'US',
      primaryContact: { name: 'SYNTHETIC Contact', email: 'private@vessy.invalid' },
    },
    actor,
  );
const detail = (id: string) => adminOrder(id, permissions);
async function move(
  id: string,
  itemId: string,
  to: FulfillmentState,
  extra: Record<string, unknown> = {},
) {
  const i = (await detail(id)).items.find((i) => i.id === itemId)!;
  return transitionOrderItem(id, itemId, { rowVersion: i.rowVersion, to, ...extra }, actor);
}
describe('FUL-003 complete transition table', () => {
  const expected: Record<string, string[]> = {
    not_released: ['released', 'cancelled'],
    released: ['in_production', 'on_hold', 'cancelled'],
    in_production: ['quality_check', 'on_hold', 'cancelled'],
    quality_check: ['in_production', 'ready_to_ship', 'on_hold', 'cancelled'],
    ready_to_ship: ['shipped', 'on_hold', 'cancelled'],
    shipped: ['delivered'],
    delivered: ['completed'],
    completed: [],
    on_hold: ['quality_check', 'cancelled'],
    cancelled: [],
  };
  const facts = {
    payment: 'succeeded',
    review: 'completed',
    supplierId: 'synthetic',
    supplierActive: true,
    dueDate: '2026-10-01',
  };
  for (const from of fulfillmentStates)
    it(`accepts exactly the allowed transitions from ${from}`, () => {
      expect(allowedTransitions(from, 'quality_check')).toEqual(expected[from]);
      for (const to of fulfillmentStates) {
        const run = () =>
          assertTransition(
            from,
            'quality_check',
            {
              rowVersion: 1,
              to,
              reason: 'SYNTHETIC',
              ...(to === 'shipped'
                ? { tracking: { carrier: 'SYNTHETIC', trackingNumber: 'fixture' } }
                : {}),
            },
            facts,
          );
        if (expected[from].includes(to)) expect(run).not.toThrow();
        else expect(run).toThrow();
      }
    });
  it('guards releases, reasons, tracking, mixed status and timezone boundaries', () => {
    for (const changed of [
      { payment: 'payment_pending' },
      { review: 'awaiting_customer' },
      { supplierActive: false },
      { supplierId: null },
      { dueDate: null },
    ])
      expect(() =>
        assertTransition(
          'not_released',
          null,
          { rowVersion: 1, to: 'released' },
          { ...facts, ...changed },
        ),
      ).toThrow();
    for (const [from, to] of [
      ['released', 'on_hold'],
      ['quality_check', 'in_production'],
      ['not_released', 'cancelled'],
    ] as const)
      expect(() => assertTransition(from, null, { rowVersion: 1, to }, facts)).toThrow();
    expect(() =>
      assertTransition('ready_to_ship', null, { rowVersion: 1, to: 'shipped' }, facts),
    ).toThrow();
    expect(() =>
      trackingInput.parse({
        carrier: 'X',
        trackingNumber: 'X',
        trackingUrl: 'javascript:alert(1)',
      }),
    ).toThrow();
    expect(derivedStatus(['completed', 'cancelled'])).toBe('completed');
    expect(derivedStatus(['shipped', 'in_production'])).toBe('in_production');
    expect(derivedStatus(['completed', 'on_hold'])).toBe('on_hold');
    expect(derivedStatus(['cancelled', 'cancelled'])).toBe('cancelled');
    const instant = new Date('2026-09-30T00:01:00Z');
    expect(opsToday('America/Los_Angeles', instant)).toBe('2026-09-29');
    expect(opsToday('Asia/Karachi', instant)).toBe('2026-09-30');
    expect(supplierOverdue('released', '2026-09-29', '2026-09-29')).toBe(false);
    expect(supplierOverdue('quality_check', '2026-09-29', '2026-09-30')).toBe(true);
    expect(supplierOverdue('ready_to_ship', '2026-09-29', '2026-09-30')).toBe(false);
  });
});
describe('SYNTHETIC fulfilment repository', { timeout: PGLITE_TIMEOUT }, () => {
  it('serializes concurrent writes, preserves assignments on supplier deactivation and rolls back a mixed bulk reassignment', async () => {
    const { order } = await syntheticOrder(),
      s = await supplier(),
      replacement = await supplier();
    let o = await detail(order.id);
    const input = { rowVersion: o.rowVersion, supplierId: s.id, dueDate: '2026-10-01' };
    const results = await Promise.allSettled([
      assignOrder(o.id, null, input, actor),
      assignOrder(o.id, null, input, actor),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { code: 'stale_row_version' },
    });
    await saveSupplier(String(s.id), { rowVersion: s.rowVersion, status: 'inactive' }, actor);
    o = await detail(o.id);
    expect(o.items.every((i) => i.supplier?.id === s.id)).toBe(true);
    await expect(releaseOrder(o.id, { rowVersion: o.rowVersion }, actor)).rejects.toMatchObject({
      code: 'release_blocked',
    });
    await assignOrder(
      o.id,
      o.items[0].id,
      {
        rowVersion: o.items[0].rowVersion,
        supplierId: s.id,
        dueDate: '2026-10-02',
        reason: 'SYNTHETIC existing deadline',
      },
      actor,
    );
    await saveSupplier(String(s.id), { rowVersion: 2, status: 'active' }, actor);
    o = await detail(o.id);
    await move(o.id, o.items[1].id, 'released');
    await move(o.id, o.items[1].id, 'in_production');
    o = await detail(o.id);
    await expect(
      assignOrder(
        o.id,
        null,
        {
          rowVersion: o.rowVersion,
          supplierId: replacement.id,
          dueDate: '2026-10-03',
          reason: 'SYNTHETIC mixed assignment',
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'transition_not_allowed' });
    const after = await detail(o.id);
    expect(after.items).toEqual(o.items);
    expect(after.events).toEqual(o.events);
  });
  it('assigns after payment, records deadline history and rejects inactive suppliers, stale writes and production reassignment', async () => {
    const { order } = await syntheticOrder(),
      s = await supplier(),
      other = await supplier();
    let o = await detail(order.id);
    await expect(releaseOrder(o.id, { rowVersion: o.rowVersion }, actor)).rejects.toMatchObject({
      code: 'release_blocked',
    });
    await assignOrder(
      o.id,
      null,
      { rowVersion: o.rowVersion, supplierId: s.id, dueDate: '2026-09-01' },
      actor,
    );
    await expect(
      assignOrder(
        o.id,
        null,
        { rowVersion: o.rowVersion, supplierId: s.id, dueDate: '2026-09-02' },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'stale_row_version' });
    o = await detail(o.id);
    await expect(
      assignOrder(
        o.id,
        o.items[0].id,
        { rowVersion: o.items[0].rowVersion, supplierId: s.id, dueDate: '2026-09-02' },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'reason_required' });
    await assignOrder(
      o.id,
      o.items[0].id,
      {
        rowVersion: o.items[0].rowVersion,
        supplierId: s.id,
        dueDate: '2026-09-02',
        reason: 'SYNTHETIC revised date',
      },
      actor,
    );
    o = await detail(o.id);
    await releaseOrder(o.id, { rowVersion: o.rowVersion }, actor);
    o = await detail(o.id);
    expect(o.items.every((i) => i.overdue)).toBe(true);
    expect(
      (await adminOrders({ overdue: 'true', supplierId: String(s.id) })).items.some(
        (i) => i.id === o.id,
      ),
    ).toBe(true);
    expect((await supplierItems(String(s.id), { status: 'overdue' })).items).toHaveLength(2);
    await move(o.id, o.items[0].id, 'in_production');
    o = await detail(o.id);
    await expect(
      assignOrder(
        o.id,
        o.items[0].id,
        {
          rowVersion: o.items[0].rowVersion,
          supplierId: other.id,
          dueDate: '2026-09-03',
          reason: 'SYNTHETIC switch',
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'transition_not_allowed' });
    await assignOrder(
      o.id,
      o.items[0].id,
      {
        rowVersion: o.items[0].rowVersion,
        supplierId: s.id,
        dueDate: '2026-10-01',
        reason: 'SYNTHETIC production delay',
      },
      actor,
    );
    await saveSupplier(
      String(other.id),
      { rowVersion: other.rowVersion, status: 'inactive' },
      actor,
    );
    o = await detail(o.id);
    await expect(
      assignOrder(
        o.id,
        o.items[1].id,
        {
          rowVersion: o.items[1].rowVersion,
          supplierId: other.id,
          dueDate: '2026-10-01',
          reason: 'SYNTHETIC',
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'supplier_inactive' });
    const deadlines = o.events.filter((e) => e.type === 'deadline_changed');
    expect(
      deadlines.some(
        (e) =>
          e.reason === 'SYNTHETIC production delay' &&
          e.from === '2026-09-02' &&
          e.to === '2026-10-01',
      ),
    ).toBe(true);
    const unpaid = await syntheticOrder({ paid: false }),
      u = await detail(unpaid.order.id);
    await expect(
      assignOrder(
        u.id,
        null,
        { rowVersion: u.rowVersion, supplierId: s.id, dueDate: '2026-10-01' },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'order_state_invalid' });
  });
  it('prevents release through every open review state; amendments feed sheets without rewriting assignments or historical snapshots', async () => {
    const { order, owner } = await syntheticOrder({ review: true }),
      s = await supplier();
    let o = await detail(order.id);
    await assignOrder(
      o.id,
      null,
      { rowVersion: o.rowVersion, supplierId: s.id, dueDate: '2026-10-01' },
      actor,
    );
    o = await detail(o.id);
    await expect(releaseOrder(o.id, { rowVersion: o.rowVersion }, actor)).rejects.toMatchObject({
      code: 'release_blocked',
    });
    const review = await claimReview(o.reviewCases[0].id, 'synthetic-tailor', {
      rowVersion: o.reviewCases[0].rowVersion,
    });
    await decideReview(o.reviewCases[0].id, 'synthetic-tailor', {
      rowVersion: Number((review.review as Record<string, unknown>).rowVersion),
      snapshotVersion: 1,
      decision: 'changes_proposed',
      proposedMeasurements: { chest: 1030 },
      customerMessage: 'SYNTHETIC proposal',
      notes: 'SYNTHETIC private body note',
    });
    o = await detail(o.id);
    await expect(releaseOrder(o.id, { rowVersion: o.rowVersion }, actor)).rejects.toMatchObject({
      code: 'release_blocked',
    });
    await respondToReview(owner, order.number, {
      actionId: crypto.randomUUID(),
      response: 'accept_changes',
    });
    o = await detail(o.id);
    expect(o.snapshot.version).toBe(2);
    expect(o.items.every((i) => i.supplier?.id === s.id)).toBe(true);
    const sheet = await productionSheet(o.id, o.items[0].id);
    expect(sheet.measurements.values.find((m) => m.id === 'chest')?.mm).toBe(1030);
    expect(sheet.amended).toBe(true);
    expect(sheet.item).toEqual(o.items[0].spec);
    expect(
      (await adminSnapshot(o.id, '1', true)).measurements!.values.find((m) => m.id === 'chest')?.mm,
    ).toBe(900);
    const support = await adminOrder(o.id, ROLE_PERMISSIONS.support);
    expect(support.snapshot.measurements).toBeNull();
    expect(support.snapshot.amendment?.changedMeasurements).toEqual([]);
    expect(JSON.stringify(support)).not.toContain('1030');
    expect(JSON.stringify(support)).not.toContain('SYNTHETIC private body note');
    expect((await adminSnapshot(o.id, '2', false)).measurements).toBeNull();
    const html = productionSheetHtml({ ...sheet, customerName: '<script>alert(1)</script>' });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('email');
    expect(html).toContain('1030');
    await releaseOrder(o.id, { rowVersion: o.rowVersion }, actor);
    expect((await detail(o.id)).fulfillment).toBe('released');
  });
  it('ships after hold/resume with private history, explicit ETA, retry-safe outbox, support lookup and derived completion', async () => {
    const { order, owner, user } = await syntheticOrder(),
      s = await supplier();
    let o = await detail(order.id);
    await assignOrder(
      o.id,
      null,
      { rowVersion: o.rowVersion, supplierId: s.id, dueDate: '2026-10-01' },
      actor,
    );
    o = await detail(o.id);
    await releaseOrder(o.id, { rowVersion: o.rowVersion }, actor);
    o = await detail(o.id);
    await move(o.id, o.items[0].id, 'on_hold', { reason: 'SYNTHETIC internal hold' });
    expect((await detail(o.id)).fulfillment).toBe('on_hold');
    await move(o.id, o.items[0].id, 'released');
    for (const item of o.items) {
      await move(o.id, item.id, 'in_production');
      await move(o.id, item.id, 'quality_check');
      await move(o.id, item.id, 'ready_to_ship');
      await expect(move(o.id, item.id, 'shipped')).rejects.toMatchObject({
        code: 'tracking_required',
      });
      await move(o.id, item.id, 'shipped', {
        tracking: {
          carrier: 'SYNTHETIC Carrier',
          trackingNumber: 'TEST-001',
          trackingUrl: 'https://example.invalid/track/TEST-001',
        },
      });
    }
    o = await detail(o.id);
    expect(o.fulfillment).toBe('shipped');
    expect(o.notifications.filter((n) => n.purpose === 'order_shipped')).toHaveLength(2);
    await updateOrderMeta(
      o.id,
      'eta',
      {
        rowVersion: o.rowVersion,
        customerEtaDate: '2026-10-04',
        reason: 'SYNTHETIC staff estimate',
      },
      actor,
    );
    await addOrderNote(o.id, { body: 'SYNTHETIC internal secret', visibility: 'internal' }, actor);
    await addOrderNote(o.id, { body: 'SYNTHETIC customer update', visibility: 'customer' }, actor);
    const customer = await customerOrder(owner, order.number),
      serialized = JSON.stringify(customer);
    expect(customer.fulfillment.etaDate).toBe('2026-10-04');
    expect(customer.items[0].tracking).toMatchObject({ carrier: 'SYNTHETIC Carrier' });
    expect(serialized).toContain('SYNTHETIC customer update');
    for (const privateText of [
      'SYNTHETIC internal',
      'Manufacturer',
      'private@vessy.invalid',
      String(s.id),
    ])
      expect(serialized).not.toContain(privateText);
    vi.spyOn(mail, 'sendOrderEmail')
      .mockRejectedValueOnce(new Error('SYNTHETIC transport failure'))
      .mockResolvedValue(undefined);
    await dispatchNotifications(order.number);
    o = await detail(o.id);
    const failed = o.notifications.find((n) => n.status === 'failed')!;
    expect(failed.attempts).toBe(1);
    expect(o.fulfillment).toBe('shipped');
    await retryNotification(failed.id, actor);
    await dispatchNotifications(order.number);
    expect((await detail(o.id)).notifications.find((n) => n.id === failed.id)).toMatchObject({
      status: 'sent',
      attempts: 2,
    });
    await expect(retryNotification(failed.id, actor)).rejects.toMatchObject({
      code: 'notification_state_invalid',
    });
    const lookup = await supportCustomer(user.userId);
    expect(lookup.draft?.measurementsConfirmed).toBe(true);
    expect(JSON.stringify(lookup)).not.toContain('chest');
    expect((await findCustomers({ query: user.email })).items[0].userId).toBe(user.userId);
    expect(
      (await operationsDashboard(ROLE_PERMISSIONS.support)).tiles.every(
        (t) => !t.label.includes('Tailor reviews'),
      ),
    ).toBe(true);
    for (const i of o.items) {
      await move(o.id, i.id, 'delivered');
      await move(o.id, i.id, 'completed');
    }
    expect((await detail(o.id)).fulfillment).toBe('completed');
    const [audit] = await (
      await db()
    ).query('SELECT count(*)::int AS n FROM audit_events WHERE actor=$1', [actor]);
    expect(Number(audit.n)).toBeGreaterThan(10);
  });
  it('makes bulk writes atomic and flags paid cancellation for manual refund', async () => {
    const { order } = await syntheticOrder(),
      s = await supplier();
    let o = await detail(order.id);
    await assignOrder(
      o.id,
      o.items[0].id,
      { rowVersion: o.items[0].rowVersion, supplierId: s.id, dueDate: '2026-10-01' },
      actor,
    );
    o = await detail(o.id);
    await expect(releaseOrder(o.id, { rowVersion: o.rowVersion }, actor)).rejects.toMatchObject({
      code: 'release_blocked',
    });
    expect((await detail(o.id)).items.every((i) => i.status === 'not_released')).toBe(true);
    await move(o.id, o.items[0].id, 'cancelled', { reason: 'SYNTHETIC cannot fulfil' });
    o = await detail(o.id);
    expect(o.needsAttention).toBe(true);
    expect(o.fulfillment).toBe('not_released');
    await move(o.id, o.items[1].id, 'cancelled', { reason: 'SYNTHETIC cannot fulfil' });
    expect((await detail(o.id)).fulfillment).toBe('cancelled');
  });
});
