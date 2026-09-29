import type { NextRequest } from 'next/server';
import { adminRoute, adminBody, json } from '@/lib/admin-http';
import { missing } from '@/db/admin-mutations';
import {
  adminOrders,
  adminOrder,
  adminSnapshot,
  assignOrder,
  transitionOrderItem,
  releaseOrder,
  updateOrderMeta,
  addOrderNote,
  productionSheet,
} from '@/db/fulfillment-repository';
import { productionSheetHtml } from '@/modules/orders/production-sheet';
import { transitionInput } from '@/modules/orders/fulfillment';
import { DomainError } from '@/modules/configuration/types';
import { dispatchNotifications } from '@/modules/notifications/dispatch';
export const runtime = 'nodejs';
type Context = { params: Promise<{ segments?: string[] }> };
export async function GET(request: NextRequest, { params }: Context) {
  return adminRoute(request, 'orders.read', async (staff) => {
    const [id, action, child, last, ...rest] = (await params).segments ?? [];
    if (rest.length) return missing();
    if (!id) return json(await adminOrders(Object.fromEntries(request.nextUrl.searchParams)));
    if (!action) return json(await adminOrder(id, staff.permissions));
    if (action === 'snapshots' && child && !last)
      return json(
        await adminSnapshot(id, child, staff.permissions.includes('orders.measurements.read')),
      );
    if (action === 'items' && child && last === 'production-sheet') {
      if (!staff.permissions.includes('orders.measurements.read'))
        throw new DomainError('forbidden', 'Measurement access is required.', 403);
      const format = request.nextUrl.searchParams.get('format') ?? 'html';
      if (!['json', 'html'].includes(format))
        throw new DomainError('validation_failed', 'Choose html or json format.', 422);
      const sheet = await productionSheet(id, child);
      return format === 'json'
        ? json(sheet)
        : new Response(productionSheetHtml(sheet), {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
              'Content-Security-Policy':
                "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'",
              'X-Content-Type-Options': 'nosniff',
            },
          });
    }
    return missing();
  });
}
async function mutate(request: NextRequest, { params }: Context) {
  return adminRoute(request, 'orders.read', async (staff) => {
    const [id, action, child, last, ...rest] = (await params).segments ?? [];
    if (!id || rest.length) return missing();
    const data = await adminBody(request),
      actor = staff.actor;
    const need = (p: (typeof staff.permissions)[number]) => {
      if (!staff.permissions.includes(p))
        throw new DomainError('forbidden', 'Your role does not allow this change.', 403);
    };
    if (request.method === 'POST' && action === 'notes' && !child) {
      need('orders.notes.write');
      return json(await addOrderNote(id, data, actor), undefined, 201);
    }
    if (request.method === 'POST' && action === 'items' && child && last === 'transition') {
      const parsed = transitionInput.parse(data);
      need(parsed.to === 'on_hold' ? 'orders.hold' : 'orders.fulfillment.write');
      await transitionOrderItem(id, child, parsed, actor);
    } else {
      need('orders.fulfillment.write');
      if (request.method === 'POST' && action === 'assignment' && !child)
        await assignOrder(id, null, data, actor);
      else if (request.method === 'POST' && action === 'items' && child && last === 'assignment')
        await assignOrder(id, child, data, actor);
      else if (request.method === 'POST' && action === 'release' && !child)
        await releaseOrder(id, data, actor);
      else if (request.method === 'POST' && action === 'attention' && child === 'clear' && !last)
        await updateOrderMeta(id, 'attention', data, actor);
      else if (request.method === 'PATCH' && action === 'eta' && !child)
        await updateOrderMeta(id, 'eta', data, actor);
      else return missing();
    }
    const order = await adminOrder(id, staff.permissions);
    await dispatchNotifications(order.number);
    if (action === 'items' && child) return json(order.items.find((i) => i.id === child));
    return json(order);
  });
}
export { mutate as POST, mutate as PATCH };
