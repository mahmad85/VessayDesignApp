import type { NextRequest } from 'next/server';
import { adminRoute, json } from '@/lib/admin-http';
import { listStaff } from '@/db/staff-repository';
export const runtime = 'nodejs';
export const GET = (request: NextRequest) =>
  adminRoute(request, 'staff.manage', async () => json({ items: await listStaff() }));
