import type { NextRequest } from 'next/server';
import { adminRoute, adminBody, json } from '@/lib/admin-http';
import {
  pricingMatrix,
  saveBands,
  saveBandPrices,
  simulation,
} from '@/db/pricing-admin-repository';
import { missing } from '@/db/admin-mutations';
export const runtime = 'nodejs';
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> },
) {
  const [action, id, sub] = (await params).segments ?? [];
  const read = request.method === 'GET' || action === 'simulate';
  return adminRoute(request, read ? 'catalog.read' : 'catalog.write', async (staff) => {
    const actor = `user:${staff.userId}`;
    if (!action && request.method === 'GET') return json(await pricingMatrix());
    if (action === 'bands' && request.method === 'PUT')
      return json(await saveBands(await adminBody(request), actor));
    if (action === 'products' && id && sub === 'band-prices' && request.method === 'PUT')
      return json(await saveBandPrices(id, await adminBody(request), actor));
    if (action === 'simulate' && request.method === 'POST')
      return json(await simulation(await adminBody(request)));
    return missing();
  });
}
export { handler as GET, handler as PUT, handler as POST };
