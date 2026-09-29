import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { body, checkOrigin, failure, json } from './http';
import { requireStaff, type StaffContext } from '@/modules/staff/authorize';
import type { Permission } from '@/modules/staff/permissions';
import { enforceLimit } from '@/db/repository';

export const adminBody = (request: NextRequest, bulk = false) =>
  body(request, { maxBytes: bulk ? 500_000 : 100_000 });
export async function adminRoute(
  request: NextRequest,
  permission: Permission | undefined,
  run: (staff: StaffContext) => Promise<Response>,
  options: { allowEnrollment?: boolean; limit?: 'publish' | 'media' } = {},
) {
  try {
    const staff = await requireStaff(request, permission, options);
    if (!['GET', 'HEAD'].includes(request.method)) {
      checkOrigin(request);
      await enforceLimit(`admin:${staff.userId}`, 300);
      if (options.limit)
        await enforceLimit(
          `admin:${options.limit}:${staff.userId}`,
          options.limit === 'publish' ? 10 : 60,
        );
    }
    return await run(staff);
  } catch (error) {
    return failure(error, { admin: true });
  }
}
export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(400).optional(),
});
export { json };
