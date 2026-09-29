import type { NextRequest } from 'next/server';
import { adminBody, adminRoute, json } from '@/lib/admin-http';
import { grantRole } from '@/db/staff-repository';
export const runtime = 'nodejs';
export const POST = (request: NextRequest) =>
  adminRoute(request, 'staff.manage', async (staff) => {
    const { created, ...result } = await grantRole(await adminBody(request), staff.actor);
    return json(result, undefined, created ? 201 : 200);
  });
