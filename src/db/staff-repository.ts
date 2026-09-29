import { z } from 'zod';
import { getDatabase } from './client';
import { writeAudit } from './audit';
import { ROLES } from '@/modules/staff/permissions';
import { DomainError } from '@/modules/configuration/types';
import { pageQuery } from '@/lib/admin-http';

export const grantSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase().trim()),
    role: z.enum(ROLES),
  })
  .strict();
export const revokeSchema = z
  .object({ userId: z.string().min(1).max(120), role: z.enum(ROLES) })
  .strict();
export async function grantRole(input: unknown, actor: string) {
  const data = grantSchema.parse(input);
  return (await getDatabase()).transaction(async (query) => {
    await query('SELECT pg_advisory_xact_lock(731852)');
    const [user] = await query<{ id: string }>(
      'SELECT id FROM "user" WHERE lower(email)=$1 AND email_verified=true FOR UPDATE',
      [data.email],
    );
    if (!user) throw new DomainError('not_found', 'No verified account was found.', 404);
    const rows = await query(
      'INSERT INTO staff_roles(user_id,role,granted_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id',
      [user.id, data.role, actor],
    );
    if (rows.length)
      await writeAudit(query, {
        actor,
        action: 'staff.grant',
        entityType: 'staff',
        entityId: user.id,
        summary: { fields: ['role'], after: { role: data.role } },
      });
    return { userId: user.id, role: data.role, created: rows.length > 0 };
  });
}
export async function revokeRole(input: unknown, actor: string) {
  const data = revokeSchema.parse(input);
  return (await getDatabase()).transaction(async (query) => {
    // Serializes owner count + mutation across all grants and revocations.
    await query('SELECT pg_advisory_xact_lock(731852)');
    const rows = await query('SELECT user_id FROM staff_roles WHERE user_id=$1 AND role=$2', [
      data.userId,
      data.role,
    ]);
    if (!rows.length) return { ok: true };
    if (data.role === 'owner') {
      const owners = await query("SELECT user_id FROM staff_roles WHERE role='owner'");
      if (owners.length === 1)
        throw new DomainError(
          'last_owner',
          'Grant another owner before removing the last owner.',
          409,
        );
    }
    await query('DELETE FROM staff_roles WHERE user_id=$1 AND role=$2', [data.userId, data.role]);
    await writeAudit(query, {
      actor,
      action: 'staff.revoke',
      entityType: 'staff',
      entityId: data.userId,
      summary: { fields: ['role'], before: { role: data.role } },
    });
    return { ok: true };
  });
}
export async function listStaff() {
  return (await getDatabase()).query(
    'SELECT u.id AS "userId",u.name,u.email,coalesce(u.two_factor_enabled,false) AS "mfaEnabled",array_agg(s.role ORDER BY s.role) AS roles,min(s.granted_at) AS "grantedAt" FROM staff_roles s JOIN "user" u ON u.id=s.user_id GROUP BY u.id ORDER BY u.name,u.id',
  );
}
const auditQuerySchema = pageQuery.extend({
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(200).optional(),
  actor: z.string().max(150).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export async function listAudit(input: unknown) {
  const data = auditQuerySchema.parse(input);
  const args: unknown[] = [];
  const where: string[] = [];
  for (const [key, column] of [
    ['entityType', 'entity_type'],
    ['entityId', 'entity_id'],
    ['actor', 'actor'],
    ['from', 'created_at'],
    ['to', 'created_at'],
  ] as const) {
    if (data[key] !== undefined) {
      args.push(data[key]);
      where.push(`${column} ${key === 'from' ? '>=' : key === 'to' ? '<=' : '='} $${args.length}`);
    }
  }
  if (data.cursor) {
    let cursor: { at: string; id: string };
    try {
      cursor = z
        .object({ at: z.iso.datetime(), id: z.uuid() })
        .parse(JSON.parse(Buffer.from(data.cursor, 'base64url').toString('utf8')));
    } catch {
      throw new DomainError('validation_failed', 'Invalid audit cursor.', 422);
    }
    args.push(cursor.at, cursor.id);
    where.push(`(created_at,id)<($${args.length - 1},$${args.length})`);
  }
  args.push(data.limit + 1);
  const rows = await (
    await getDatabase()
  ).query(
    `SELECT id,actor,action,entity_type AS "entityType",entity_id AS "entityId",summary,created_at AS "createdAt" FROM audit_events ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC,id DESC LIMIT $${args.length}`,
    args,
  );
  const items = rows.slice(0, data.limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > data.limit && last
        ? Buffer.from(
            JSON.stringify({ at: new Date(last.createdAt as string).toISOString(), id: last.id }),
          ).toString('base64url')
        : null,
  };
}
