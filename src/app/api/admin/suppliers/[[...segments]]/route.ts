import type { NextRequest } from 'next/server';
import { adminRoute, adminBody, json } from '@/lib/admin-http';
import {
  listSuppliers,
  supplierDetail,
  saveSupplier,
  putSupplierContact,
  removeSupplierContact,
} from '@/db/supplier-repository';
import { missing } from '@/db/admin-mutations';
import { supplierItems } from '@/db/fulfillment-repository';
import { DomainError } from '@/modules/configuration/types';
export const runtime = 'nodejs';
type Context = { params: Promise<{ segments?: string[] }> };
async function handler(request: NextRequest, { params }: Context) {
  const [id, action, rank] = (await params).segments ?? [];
  return adminRoute(
    request,
    request.method === 'GET' ? 'suppliers.read' : 'suppliers.write',
    async (staff) => {
      const actor = `user:${staff.userId}`;
      if (id && action === 'items' && !rank && request.method === 'GET') {
        if (!staff.permissions.includes('orders.read'))
          throw new DomainError('forbidden', 'Order access is required.', 403);
        return json(await supplierItems(id, Object.fromEntries(request.nextUrl.searchParams)));
      }
      if (!id && request.method === 'GET')
        return json(await listSuppliers(Object.fromEntries(request.nextUrl.searchParams)));
      if (!id && request.method === 'POST')
        return json(await saveSupplier(null, await adminBody(request), actor), undefined, 201);
      if (id && !action && request.method === 'GET') return json(await supplierDetail(id));
      if (id && !action && request.method === 'PATCH')
        return json(await saveSupplier(id, await adminBody(request), actor));
      if (action === 'contacts' && rank && request.method === 'PUT')
        return json(await putSupplierContact(id, rank, await adminBody(request), actor));
      if (action === 'contacts' && rank && request.method === 'DELETE')
        return json(await removeSupplierContact(id, rank, actor));
      return missing();
    },
  );
}
export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
