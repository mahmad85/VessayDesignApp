import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { createSyntheticUser } from './helpers/users';
import { apiRequest } from './helpers/http';
import { grantRole, revokeRole, listAudit } from '../src/db/staff-repository';
import { ROLES } from '../src/modules/staff/permissions';
import { GET as me } from '../src/app/api/admin/me/route';
import { GET as staff } from '../src/app/api/admin/staff/route';
import { GET as audit } from '../src/app/api/admin/audit/route';
import { POST as grant } from '../src/app/api/admin/staff/grants/route';
import { POST as revoke } from '../src/app/api/admin/staff/revocations/route';
const database = setupTestDatabase();
afterEach(() => vi.unstubAllEnvs());
describe('SYNTHETIC staff endpoints (WP-20)', { timeout: PGLITE_TIMEOUT }, () => {
  it('enforces every role on every staff endpoint and requires origin on mutations', async () => {
    vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
    const user = await createSyntheticUser();
    const db = await database();
    for (const role of [null, ...ROLES]) {
      await db.query('DELETE FROM staff_roles WHERE user_id=$1', [user.userId]);
      if (role) await grantRole({ email: user.email, role }, 'system:test');
      for (const [handler, pathname, json] of [
        [me, '/api/admin/me', undefined],
        [staff, '/api/admin/staff', undefined],
        [audit, '/api/admin/audit', undefined],
        [grant, '/api/admin/staff/grants', { email: 'missing@example.com', role: 'support' }],
        [revoke, '/api/admin/staff/revocations', { userId: 'missing', role: 'support' }],
      ] as const) {
        const response = await handler(apiRequest(pathname, { cookies: user.cookie, json }));
        expect(response.status, `${role}: ${pathname}`).toBe(
          pathname.endsWith('/me') && role
            ? 200
            : role === 'owner'
              ? pathname.endsWith('/grants')
                ? 404
                : 200
              : 403,
        );
        expect(response.headers.get('cache-control')).toBe('no-store');
      }
    }
    await grantRole({ email: user.email, role: 'owner' }, 'system:test');
    expect(
      (
        await grant(
          apiRequest('/api/admin/staff/grants', {
            cookies: user.cookie,
            origin: null,
            json: { email: user.email, role: 'support' },
          }),
        )
      ).status,
    ).toBe(403);
    vi.stubEnv('STAFF_MFA_REQUIRED', 'true');
    expect((await me(apiRequest('/api/admin/me', { cookies: user.cookie }))).status).toBe(200);
    expect((await staff(apiRequest('/api/admin/staff', { cookies: user.cookie }))).status).toBe(
      403,
    );
    expect((await me(apiRequest('/api/admin/me'))).status).toBe(401);
  });
  it('requires verified accounts, records no contact data, rolls back with the audit, and protects the last owner', async () => {
    const unverified = await createSyntheticUser({ verified: false });
    await expect(
      grantRole({ email: unverified.email, role: 'support' }, 'system:test'),
    ).rejects.toMatchObject({ code: 'not_found' });
    const user = await createSyntheticUser();
    const other = await createSyntheticUser();
    const db = await database();
    await db.query('DELETE FROM staff_roles');
    await expect(
      grantRole({ email: user.email, role: 'owner' }, 'invalid actor'),
    ).rejects.toThrow();
    expect(await db.query('SELECT * FROM staff_roles')).toHaveLength(0);
    expect((await grantRole({ email: user.email, role: 'owner' }, 'system:cli')).created).toBe(
      true,
    );
    expect((await grantRole({ email: user.email, role: 'owner' }, 'system:cli')).created).toBe(
      false,
    );
    await expect(
      revokeRole({ userId: user.userId, role: 'owner' }, 'system:cli'),
    ).rejects.toMatchObject({ code: 'last_owner' });
    await grantRole({ email: other.email, role: 'owner' }, 'system:cli');
    const results = await Promise.allSettled([
      revokeRole({ userId: user.userId, role: 'owner' }, 'system:cli'),
      revokeRole({ userId: other.userId, role: 'owner' }, 'system:cli'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const events = await listAudit({ entityType: 'staff', entityId: user.userId, limit: 1 });
    expect(events.items).toHaveLength(1);
    expect(events.nextCursor).toBeTruthy();
    expect(
      (
        await listAudit({
          entityType: 'staff',
          entityId: user.userId,
          limit: 1,
          cursor: events.nextCursor,
        })
      ).items[0].id,
    ).not.toBe(events.items[0].id);
    expect(JSON.stringify(events)).not.toContain(user.email);
  });
  it('reports field paths and enforces body size and shared per-user rate limits', async () => {
    vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
    const user = await createSyntheticUser();
    await grantRole({ email: user.email, role: 'owner' }, 'system:test');
    const response = await grant(
      apiRequest('/api/admin/staff/grants', {
        cookies: user.cookie,
        json: { email: 'bad', role: 'fake' },
      }),
    );
    expect(response.status).toBe(422);
    expect(
      (await response.json()).error.details.fields.map((f: { path: string }) => f.path),
    ).toContain('email');
    expect(
      (
        await grant(
          apiRequest('/api/admin/staff/grants', {
            cookies: user.cookie,
            json: { data: 'x'.repeat(100_001) },
          }),
        )
      ).status,
    ).toBe(413);
    await (
      await database()
    ).query('UPDATE request_limits SET count=300 WHERE key=$1', [`admin:${user.userId}`]);
    expect(
      (
        await grant(
          apiRequest('/api/admin/staff/grants', {
            cookies: user.cookie,
            json: { email: user.email, role: 'support' },
          }),
        )
      ).status,
    ).toBe(429);
  });
});
