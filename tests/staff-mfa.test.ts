import { describe, it, expect, vi, afterEach } from 'vitest';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { createSyntheticUser } from './helpers/users';
import { cookiesFrom } from './helpers/http';
import { totp } from './helpers/totp';
import { getAuth } from '../src/lib/auth';
import { grantRole } from '../src/db/staff-repository';
import { requireStaff } from '../src/modules/staff/authorize';
setupTestDatabase();
afterEach(() => vi.unstubAllEnvs());
describe(
  'SYNTHETIC real Better Auth TOTP and backup-code contract',
  { timeout: PGLITE_TIMEOUT },
  () => {
    it('matches the RFC test timestamp', () => {
      expect(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000)).toBe('287082');
    });
    it('enrolls, revokes old sessions, challenges password login, rejects wrong codes and consumes backup codes once', async () => {
      vi.stubEnv('STAFF_MFA_REQUIRED', 'true');
      const user = await createSyntheticUser();
      await grantRole({ email: user.email, role: 'owner' }, 'system:test');
      const auth = await getAuth();
      const oldLogin = await auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        asResponse: true,
      });
      const headers = new Headers({ cookie: user.cookie });
      const setup = await auth.api.enableTwoFactor({ headers, body: { password: user.password } });
      expect(setup.method).toBe('totp');
      if (setup.method !== 'totp') throw new Error('Expected TOTP');
      await expect(requireStaff({ headers }, 'catalog.read')).rejects.toMatchObject({
        code: 'mfa_required',
      });
      const secret = new URL(setup.totpURI).searchParams.get('secret')!;
      const verified = await auth.api.verifyTOTP({
        headers,
        body: { code: totp(secret) },
        asResponse: true,
      });
      expect(verified.status).toBe(200);
      const enrolledHeaders = new Headers({ cookie: cookiesFrom(verified) });
      expect((await requireStaff({ headers: enrolledHeaders }, 'catalog.read')).mfa.enabled).toBe(
        true,
      );
      await expect(
        requireStaff({ headers: new Headers({ cookie: cookiesFrom(oldLogin) }) }, 'catalog.read'),
      ).rejects.toMatchObject({ code: 'sign_in_required' });
      const login = await auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        asResponse: true,
      });
      expect(await login.json()).toMatchObject({ twoFactorRedirect: true });
      const challenge = new Headers({ cookie: cookiesFrom(login) });
      await expect(requireStaff({ headers: challenge }, 'catalog.read')).rejects.toMatchObject({
        code: 'sign_in_required',
      });
      const wrong = await auth.api.verifyTOTP({
        headers: challenge,
        body: { code: 'invalid' },
        asResponse: true,
      });
      expect(wrong.ok).toBe(false);
      const good = await auth.api.verifyTOTP({
        headers: challenge,
        body: { code: totp(secret) },
        asResponse: true,
      });
      expect(good.ok).toBe(true);
      expect(
        (
          await requireStaff(
            { headers: new Headers({ cookie: cookiesFrom(good) }) },
            'catalog.read',
          )
        ).mfa.enabled,
      ).toBe(true);
      const backupLogin = await auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        asResponse: true,
      });
      const backup = await auth.api.verifyBackupCode({
        headers: new Headers({ cookie: cookiesFrom(backupLogin) }),
        body: { code: setup.backupCodes[0] },
        asResponse: true,
      });
      expect(backup.ok).toBe(true);
      const retryLogin = await auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        asResponse: true,
      });
      const retry = await auth.api.verifyBackupCode({
        headers: new Headers({ cookie: cookiesFrom(retryLogin) }),
        body: { code: setup.backupCodes[0] },
        asResponse: true,
      });
      expect(retry.ok).toBe(false);
    });
  },
);
