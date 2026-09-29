import type { NextRequest } from 'next/server';
import { adminRoute, json } from '@/lib/admin-http';
import { operationsDashboard } from '@/db/operations-repository';
export async function GET(request: NextRequest) {
  return adminRoute(request, undefined, async (staff) =>
    json(await operationsDashboard(staff.permissions)),
  );
}
