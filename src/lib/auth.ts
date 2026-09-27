import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDatabase } from '@/db/client';
import * as schema from '@/db/schema';
import { sendAccountEmail } from '@/integrations/mail';
const authGlobal = globalThis as unknown as { vessyAuth?: Promise<ReturnType<typeof betterAuth>> };
export function authConfigured() {
  return (
    process.env.NODE_ENV !== 'production' ||
    !!(
      process.env.BETTER_AUTH_SECRET &&
      process.env.APP_URL &&
      process.env.DATABASE_URL &&
      process.env.MAIL_API_URL &&
      process.env.MAIL_API_TOKEN &&
      process.env.MAIL_FROM
    )
  );
}
async function authSecret() {
  if (process.env.BETTER_AUTH_SECRET) {
    if (process.env.BETTER_AUTH_SECRET.length < 32)
      throw new Error('BETTER_AUTH_SECRET must have at least 32 characters.');
    return process.env.BETTER_AUTH_SECRET;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Authentication is not configured.');
  const file = path.join(process.cwd(), '.data/auth-secret');
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    return await readFile(file, 'utf8');
  } catch {
    const value = randomBytes(48).toString('base64url');
    try {
      await writeFile(file, value, { flag: 'wx', mode: 0o600 });
      return value;
    } catch {
      return readFile(file, 'utf8');
    }
  }
}
export function getAuth() {
  if (!authGlobal.vessyAuth)
    authGlobal.vessyAuth = (async () => {
      if (!authConfigured()) throw new Error('Authentication is not configured.');
      const db = await getDatabase();
      return betterAuth<BetterAuthOptions>({
        appName: 'Vessy',
        baseURL: process.env.APP_URL || 'http://localhost:3000',
        secret: await authSecret(),
        database: drizzleAdapter(db.orm, { provider: 'pg', schema }),
        emailAndPassword: {
          enabled: true,
          minPasswordLength: 12,
          requireEmailVerification: true,
          revokeSessionsOnPasswordReset: true,
          sendResetPassword: async ({ user, url }) =>
            sendAccountEmail(user.email, 'Reset your Vessy password', url),
        },
        emailVerification: {
          sendOnSignUp: true,
          sendVerificationEmail: async ({ user, url }) =>
            sendAccountEmail(user.email, 'Verify your Vessy email', url),
        },
        rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
        session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
        advanced: { useSecureCookies: process.env.NODE_ENV === 'production' },
      });
    })().catch((e) => {
      authGlobal.vessyAuth = undefined;
      throw e;
    });
  return authGlobal.vessyAuth!;
}
