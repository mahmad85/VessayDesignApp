import type { NextRequest } from 'next/server';
import { adminRoute, json } from '@/lib/admin-http';
import { missing } from '@/db/admin-mutations';
import { findCustomers, supportCustomer } from '@/db/operations-repository';
export const runtime = 'nodejs';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> },
) {
  return adminRoute(request, 'customers.read', async () => {
    const [id, ...rest] = (await params).segments ?? [];
    if (rest.length) return missing();
    return json(
      id
        ? await supportCustomer(id)
        : await findCustomers(Object.fromEntries(request.nextUrl.searchParams)),
    );
  });
}
