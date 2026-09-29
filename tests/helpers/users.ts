import { getAuth } from '../../src/lib/auth';
import { getDatabase } from '../../src/db/client';

// SYNTHETIC accounts created through Better Auth in the test database. Email
// verification is completed directly in the database, standing in for the
// emailed link that tests/e2e/studio.spec.ts follows in a real browser.

const SYNTHETIC_SECRET = 'synthetic-test-secret-never-use-for-production';

export type SyntheticUser = {
  userId: string;
  email: string;
  name: string;
  password: string;
  /** Session `Cookie` header for authenticated requests. */
  cookie: string;
};

export async function createSyntheticUser(
  options: { name?: string; verified?: boolean } = {},
): Promise<SyntheticUser> {
  process.env.BETTER_AUTH_SECRET ||= SYNTHETIC_SECRET;
  const auth = await getAuth();
  const email = `synthetic-${crypto.randomUUID()}@vessy.invalid`;
  const password = 'Synthetic-only-password-123';
  const name = options.name ?? 'SYNTHETIC Test Customer';
  const signup = await auth.api.signUpEmail({ body: { name, email, password } });
  const userId = signup.user.id;
  if (options.verified === false) return { userId, email, name, password, cookie: '' };
  const db = await getDatabase();
  await db.query('UPDATE "user" SET email_verified=true WHERE id=$1', [userId]);
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  if (!response.ok) throw new Error(`Synthetic sign-in failed with ${response.status}.`);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  return { userId, email, name, password, cookie };
}
