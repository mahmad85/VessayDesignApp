import { describe, it, expect, vi, afterEach } from 'vitest';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { createSyntheticUser } from './helpers/users';
import { apiRequest } from './helpers/http';
import { GET, POST } from '../src/app/api/orders/[[...segments]]/route';
import {
  GET as reviews,
  POST as reviewCommand,
} from '../src/app/api/admin/reviews/[[...segments]]/route';
import { POST as removed } from '../src/app/api/checkout/route';
import { POST as testHook } from '../src/app/api/test/orders/route';
import { grantRole } from '../src/db/staff-repository';
import { ROLE_PERMISSIONS, type Role } from '../src/modules/staff/permissions';
setupTestDatabase();
afterEach(() => vi.unstubAllEnvs());
const ctx = (...segments: string[]) => ({ params: Promise.resolve({ segments }) });
describe('M5 actual HTTP ownership and role guards', { timeout: PGLITE_TIMEOUT }, () => {
  it('requires sign-in, blocks CSRF, hides non-owned orders and removes the old checkout', async () => {
    expect((await GET(apiRequest('/api/orders'), ctx())).status).toBe(401);
    expect((await POST(apiRequest('/api/orders', { json: {} }), ctx())).status).toBe(401);
    const user = await createSyntheticUser();
    expect(
      (
        await POST(
          apiRequest('/api/orders', {
            cookies: user.cookie,
            json: {},
            origin: 'https://foreign.invalid',
          }),
          ctx(),
        )
      ).status,
    ).toBe(403);
    expect(
      (await GET(apiRequest('/api/orders/VS-000001', { cookies: user.cookie }), ctx('VS-000001')))
        .status,
    ).toBe(404);
    expect((await removed()).status).toBe(410);
    vi.stubEnv('VESSY_E2E_HOOKS', 'true');
    vi.stubEnv('PAYMENT_PROVIDER', 'fake');
    vi.stubEnv('NODE_ENV', 'production');
    expect(
      (await testHook(apiRequest('/api/test/orders', { json: { number: 'VS-000001' } }))).status,
    ).toBe(404);
  });
  it('applies the review matrix to each role, including support measurement isolation and MFA', async () => {
    vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
    for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
      const user = await createSyntheticUser();
      await grantRole({ email: user.email, role }, 'system:test');
      const allowedRead = ROLE_PERMISSIONS[role].includes('reviews.read'),
        allowedDecide = ROLE_PERMISSIONS[role].includes('reviews.decide');
      const read = await reviews(apiRequest('/api/admin/reviews', { cookies: user.cookie }), ctx());
      expect(read.status, role).toBe(allowedRead ? 200 : 403);
      const detail = await reviews(
        apiRequest('/api/admin/reviews/unknown', { cookies: user.cookie }),
        ctx('unknown'),
      );
      expect(detail.status, role).toBe(allowedRead ? 404 : 403);
      const write = await reviewCommand(
        apiRequest('/api/admin/reviews/unknown/claim', {
          cookies: user.cookie,
          json: { rowVersion: 1 },
        }),
        ctx('unknown', 'claim'),
      );
      expect(write.status, role).toBe(allowedDecide ? 404 : 403);
      if (role === 'tailor') {
        vi.stubEnv('STAFF_MFA_REQUIRED', 'true');
        expect(
          (await reviews(apiRequest('/api/admin/reviews', { cookies: user.cookie }), ctx())).status,
        ).toBe(403);
        vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
      }
    }
  });
});
