import type { NextRequest } from 'next/server';
import { adminBody, adminRoute, json } from '@/lib/admin-http';
import { revokeRole } from '@/db/staff-repository';
export const runtime = 'nodejs';
export const POST = (request: NextRequest) =>
  adminRoute(request, 'staff.manage', async (staff) =>
    json(await revokeRole(await adminBody(request), staff.actor)),
  );
