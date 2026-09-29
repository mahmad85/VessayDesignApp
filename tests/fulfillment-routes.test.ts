import { beforeAll, afterEach, describe, it, expect, vi } from 'vitest';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { createSyntheticUser } from './helpers/users';
import { syntheticOrder } from './helpers/orders';
import { apiRequest, type TestRequestInit } from './helpers/http';
import { publishE2ECatalog } from '../src/db/e2e-catalog';
import { grantRole } from '../src/db/staff-repository';
import { ROLE_PERMISSIONS, type Role, type Permission } from '../src/modules/staff/permissions';
import { GET, POST, PATCH } from '../src/app/api/admin/orders/[[...segments]]/route';
import { GET as customers } from '../src/app/api/admin/customers/[[...segments]]/route';
import { GET as suppliers } from '../src/app/api/admin/suppliers/[[...segments]]/route';
import { POST as retry } from '../src/app/api/admin/notifications/[id]/retry/route';
import { GET as dashboard } from '../src/app/api/admin/dashboard/route';
import { adminOrder } from '../src/db/fulfillment-repository';
import { saveSupplier } from '../src/db/supplier-repository';
setupTestDatabase();
beforeAll(async () => {
  process.env.VESSY_E2E_HOOKS = 'true';
  process.env.PAYMENT_PROVIDER = 'fake';
  process.env.STRIPE_ORDER_WEBHOOK_SECRET = 'whsec_SYNTHETIC_orders_only';
  await publishE2ECatalog('priced');
}, PGLITE_TIMEOUT);
afterEach(() => vi.unstubAllEnvs());
const ctx = (...segments: string[]) => ({ params: Promise.resolve({ segments }) });
describe('M6 real route authorization and contracts', { timeout: PGLITE_TIMEOUT }, () => {
  it('enforces the permission matrix, MFA and origin for every new endpoint', async () => {
    vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
    type Case = {
      name: string;
      permission: Permission[];
      run: (cookie: string, origin?: string) => Promise<Response>;
    };
    const orderCase = (
      name: string,
      permission: Permission[],
      method: 'GET' | 'POST' | 'PATCH',
      segments: string[],
      data?: unknown,
    ): Case => ({
      name,
      permission,
      run: (cookie, origin) =>
        ({ GET, POST, PATCH })[method](
          apiRequest('/api/admin/orders/' + segments.join('/'), {
            method,
            cookies: cookie,
            origin,
            json: data,
          }),
          ctx(...segments),
        ),
    });
    const cases: Case[] = [
      orderCase('list', ['orders.read'], 'GET', []),
      orderCase('detail', ['orders.read'], 'GET', ['unknown']),
      orderCase('snapshot', ['orders.read'], 'GET', ['unknown', 'snapshots', '1']),
      orderCase('sheet', ['orders.read', 'orders.measurements.read'], 'GET', [
        'unknown',
        'items',
        'unknown',
        'production-sheet',
      ]),
      orderCase(
        'assign all',
        ['orders.read', 'orders.fulfillment.write'],
        'POST',
        ['unknown', 'assignment'],
        { rowVersion: 1, supplierId: crypto.randomUUID(), dueDate: '2026-10-01' },
      ),
      orderCase(
        'assign item',
        ['orders.read', 'orders.fulfillment.write'],
        'POST',
        ['unknown', 'items', 'unknown', 'assignment'],
        { rowVersion: 1, supplierId: crypto.randomUUID(), dueDate: '2026-10-01' },
      ),
      orderCase(
        'transition',
        ['orders.read', 'orders.fulfillment.write'],
        'POST',
        ['unknown', 'items', 'unknown', 'transition'],
        { rowVersion: 1, to: 'in_production' },
      ),
      orderCase(
        'hold',
        ['orders.read', 'orders.hold'],
        'POST',
        ['unknown', 'items', 'unknown', 'transition'],
        { rowVersion: 1, to: 'on_hold', reason: 'SYNTHETIC' },
      ),
      orderCase(
        'release',
        ['orders.read', 'orders.fulfillment.write'],
        'POST',
        ['unknown', 'release'],
        { rowVersion: 1 },
      ),
      orderCase('eta', ['orders.read', 'orders.fulfillment.write'], 'PATCH', ['unknown', 'eta'], {
        rowVersion: 1,
        customerEtaDate: null,
        reason: 'SYNTHETIC',
      }),
      orderCase(
        'clear',
        ['orders.read', 'orders.fulfillment.write'],
        'POST',
        ['unknown', 'attention', 'clear'],
        { rowVersion: 1, reason: 'SYNTHETIC' },
      ),
      orderCase('notes', ['orders.read', 'orders.notes.write'], 'POST', ['unknown', 'notes'], {
        body: 'SYNTHETIC',
        visibility: 'internal',
      }),
      {
        name: 'customers',
        permission: ['customers.read'],
        run: (c) =>
          customers(apiRequest('/api/admin/customers?query=SYNTHETIC', { cookies: c }), ctx()),
      },
      {
        name: 'customer detail',
        permission: ['customers.read'],
        run: (c) =>
          customers(apiRequest('/api/admin/customers/unknown', { cookies: c }), ctx('unknown')),
      },
      {
        name: 'supplier items',
        permission: ['suppliers.read', 'orders.read'],
        run: (c) =>
          suppliers(
            apiRequest('/api/admin/suppliers/unknown/items', { cookies: c }),
            ctx('unknown', 'items'),
          ),
      },
      {
        name: 'retry',
        permission: ['orders.notifications.retry'],
        run: (c, origin) =>
          retry(
            apiRequest('/api/admin/notifications/unknown/retry', { cookies: c, origin, json: {} }),
            { params: Promise.resolve({ id: 'unknown' }) },
          ),
      },
    ];
    const customer = await createSyntheticUser();
    for (const c of cases) {
      expect((await c.run('')).status, c.name).toBe(401);
      expect((await c.run(customer.cookie)).status, c.name).toBe(403);
    }
    for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
      const user = await createSyntheticUser();
      await grantRole({ email: user.email, role }, 'system:test');
      for (const c of cases) {
        const r = await c.run(user.cookie);
        expect(r.status, role + ' ' + c.name).toBe(
          c.permission.every((p) => ROLE_PERMISSIONS[role].includes(p))
            ? c.name === 'list' || c.name === 'customers'
              ? 200
              : 404
            : 403,
        );
      }
      vi.stubEnv('STAFF_MFA_REQUIRED', 'true');
      for (const c of cases) {
        const r = await c.run(user.cookie);
        expect(r.status, c.name).toBe(403);
        expect((await r.json()).error.code).toBe('mfa_required');
      }
      vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
      expect((await cases[4].run(user.cookie, 'https://foreign.invalid')).status).toBe(403);
      expect(
        (await dashboard(apiRequest('/api/admin/dashboard', { cookies: user.cookie }))).status,
      ).toBe(200);
    }
  });
  it('returns redacted support DTOs and applies valid commands through the HTTP boundary', async () => {
    vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
    const manager = await createSyntheticUser();
    await grantRole({ email: manager.email, role: 'order_manager' }, 'system:test');
    const support = await createSyntheticUser();
    await grantRole({ email: support.email, role: 'support' }, 'system:test');
    const { order, user } = await syntheticOrder(),
      s = await saveSupplier(
        null,
        {
          code: 'synthetic-' + crypto.randomUUID(),
          name: 'SYNTHETIC Route Manufacturer',
          kind: 'manufacturer',
          status: 'active',
          addressLine1: 'SYNTHETIC road',
          city: 'Fixture',
          countryCode: 'US',
          primaryContact: { name: 'SYNTHETIC Contact' },
        },
        'system:test',
      );
    let o = await adminOrder(order.id, ROLE_PERMISSIONS.order_manager);
    const command = async (
      segments: string[],
      json: unknown,
      method: TestRequestInit['method'] = 'POST',
    ) => {
      const r = await (method === 'PATCH' ? PATCH : POST)(
        apiRequest('/api/admin/orders/' + segments.join('/'), {
          cookies: manager.cookie,
          method,
          json,
        }),
        ctx(...segments),
      );
      expect(r.status, await r.text()).toBe(200);
    };
    await command([o.id, 'assignment'], {
      rowVersion: o.rowVersion,
      supplierId: s.id,
      dueDate: '2026-10-01',
    });
    o = await adminOrder(o.id, ROLE_PERMISSIONS.order_manager);
    await command([o.id, 'release'], { rowVersion: o.rowVersion });
    const redacted = await GET(
      apiRequest('/api/admin/orders/' + o.id, { cookies: support.cookie }),
      ctx(o.id),
    );
    expect(redacted.status).toBe(200);
    const body = await redacted.json();
    expect(body.snapshot.measurements).toBeNull();
    expect(body.items[0].allowedTransitions).toEqual([]);
    const sheet = await GET(
      apiRequest(`/api/admin/orders/${o.id}/items/${o.items[0].id}/production-sheet`, {
        cookies: manager.cookie,
      }),
      ctx(o.id, 'items', o.items[0].id, 'production-sheet'),
    );
    expect(sheet.status).toBe(200);
    expect(sheet.headers.get('cache-control')).toBe('no-store');
    expect(await sheet.text()).toContain('Production sheet');
    const lookup = await customers(
      apiRequest('/api/admin/customers/' + user.userId, { cookies: support.cookie }),
      ctx(user.userId),
    );
    expect(lookup.status).toBe(200);
    const raw = await lookup.text();
    expect(raw).not.toContain('chest');
    expect(raw).not.toContain('conversation');
  });
});
