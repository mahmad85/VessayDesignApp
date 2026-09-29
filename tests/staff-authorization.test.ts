import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { createSyntheticUser } from './helpers/users';
import { requireStaff, mfaRequired } from '../src/modules/staff/authorize';
import { PERMISSIONS, ROLES, permissionsFor } from '../src/modules/staff/permissions';
const database = setupTestDatabase();
afterEach(() => vi.unstubAllEnvs());
describe('SYNTHETIC staff authorization (WP-19)', { timeout: PGLITE_TIMEOUT }, () => {
  it('matches every cell in the canonical role matrix, with union semantics', () => {
    const allowed = [
      '11111',
      '11000',
      '11000',
      '10000',
      '11100',
      '11100',
      '10111',
      '10110',
      '10100',
      '10110',
      '10111',
      '10101',
      '10110',
      '10010',
      '10101',
      '10000',
      '10000',
    ];
    PERMISSIONS.forEach((permission, i) =>
      ROLES.forEach((role, j) =>
        expect(permissionsFor([role]).includes(permission), `${role}: ${permission}`).toBe(
          allowed[i][j] === '1',
        ),
      ),
    );
    expect(permissionsFor(['catalog_manager', 'tailor'])).toContain('reviews.decide');
    expect(permissionsFor(['catalog_manager', 'tailor'])).not.toContain('staff.manage');
  });
  it('cannot turn MFA off in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
    expect(mfaRequired()).toBe(true);
  });
  it('enforces session, roles, enrollment and permission; ordinary customer sign-in remains valid', async () => {
    const request = { headers: new Headers() };
    await expect(requireStaff(request, 'catalog.read')).rejects.toMatchObject({
      code: 'sign_in_required',
      status: 401,
    });
    const user = await createSyntheticUser();
    request.headers.set('cookie', user.cookie);
    await expect(requireStaff(request, 'catalog.read')).rejects.toMatchObject({
      code: 'forbidden',
    });
    const db = await database();
    await db.query(
      "INSERT INTO staff_roles(user_id,role,granted_by) VALUES($1,'support','system:test')",
      [user.userId],
    );
    vi.stubEnv('STAFF_MFA_REQUIRED', 'true');
    await expect(requireStaff(request, 'catalog.read')).rejects.toMatchObject({
      code: 'mfa_required',
    });
    expect((await requireStaff(request, undefined, { allowEnrollment: true })).mfa.enabled).toBe(
      false,
    );
    vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
    expect((await requireStaff(request, 'catalog.read')).roles).toEqual(['support']);
    await expect(requireStaff(request, 'orders.measurements.read')).rejects.toMatchObject({
      code: 'forbidden',
    });
    await db.query('DELETE FROM staff_roles WHERE user_id=$1', [user.userId]);
    await expect(requireStaff(request, 'catalog.read')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});
