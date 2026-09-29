import { getAuth, authConfigured } from '@/lib/auth';
import { getDatabase } from '@/db/client';
import { DomainError } from '@/modules/configuration/types';
import { permissionsFor, type Role, type Permission } from './permissions';

export const mfaRequired = () =>
  process.env.NODE_ENV === 'production' || process.env.STAFF_MFA_REQUIRED === 'true';
export async function getStaffContext(headers: Headers) {
  const session = authConfigured() ? await (await getAuth()).api.getSession({ headers }) : null;
  if (!session) return null;
  const db = await getDatabase();
  const rows = await db.query<{ role: Role }>(
    'SELECT role FROM staff_roles WHERE user_id=$1 ORDER BY role',
    [session.user.id],
  );
  const roles = rows.map((r) => r.role);
  // Read current enrollment from the database, never from a browser flag or cached session payload.
  const [user] = await db.query<{ enabled: boolean }>(
    'SELECT u.two_factor_enabled AS enabled FROM "user" u JOIN session s ON s.user_id=u.id WHERE u.id=$1 AND s.id=$2 AND s.expires_at>now()',
    [session.user.id, session.session.id],
  );
  if (!user) return null;
  return {
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    userId: session.user.id,
    actor: `user:${session.user.id}`,
    roles,
    permissions: permissionsFor(roles),
    mfa: { required: mfaRequired(), enabled: user?.enabled === true },
  };
}
export type StaffContext = NonNullable<Awaited<ReturnType<typeof getStaffContext>>>;
export async function requireStaff(
  request: { headers: Headers },
  permission?: Permission,
  options: { allowEnrollment?: boolean } = {},
) {
  const context = await getStaffContext(request.headers);
  if (!context) throw new DomainError('sign_in_required', 'Sign in to continue.', 401);
  if (!context.roles.length) throw new DomainError('forbidden', 'Staff access is required.', 403);
  if (!options.allowEnrollment && context.mfa.required && !context.mfa.enabled)
    throw new DomainError('mfa_required', 'Set up your authenticator app to continue.', 403);
  if (permission && !context.permissions.includes(permission))
    throw new DomainError('forbidden', 'You do not have permission for this action.', 403);
  return context;
}
