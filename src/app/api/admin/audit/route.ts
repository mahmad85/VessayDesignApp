import type { NextRequest } from 'next/server';
import { adminRoute, json } from '@/lib/admin-http';
import { listAudit } from '@/db/staff-repository';
export const runtime = 'nodejs';
export const GET = (request: NextRequest) =>
  adminRoute(request, 'audit.read', async () =>
    json(await listAudit(Object.fromEntries(request.nextUrl.searchParams))),
  );
