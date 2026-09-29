import type { NextRequest } from 'next/server';
import { adminRoute, json } from '@/lib/admin-http';
export const runtime = 'nodejs';
export const GET = (request: NextRequest) =>
  adminRoute(
    request,
    undefined,
    async (staff) =>
      json({
        user: staff.user,
        roles: staff.roles,
        permissions: staff.permissions,
        mfa: staff.mfa,
      }),
    { allowEnrollment: true },
  );
