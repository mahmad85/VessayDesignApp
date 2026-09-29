import type { NextRequest } from 'next/server';
import { identity, requireSignedIn, checkOrigin, body, json, failure } from '@/lib/http';
import { enforceLimit } from '@/db/repository';
import {
  customerOrders,
  customerOrder,
  submitOrder,
  cancelOrder,
  respondToReview,
} from '@/db/order-repository';
import { checkoutOrder } from '@/db/payment-repository';
import { dispatchNotifications } from '@/modules/notifications/dispatch';
import { DomainError } from '@/modules/configuration/types';
export async function orderRoute(request: NextRequest, segments: string[] = []) {
  try {
    const who = requireSignedIn(await identity(request)),
      [number, action, respond] = segments;
    if (request.method === 'GET') {
      if (!number)
        return json(
          await customerOrders(who.owner, Object.fromEntries(request.nextUrl.searchParams)),
        );
      if (segments.length === 1) {
        const order = await customerOrder(who.owner, number);
        await dispatchNotifications(number);
        return json({ order });
      }
    }
    if (request.method === 'POST') {
      checkOrigin(request);
      await enforceLimit(`${who.owner}:orders`, 10);
      const input = await body(request);
      if (!number) {
        const result = await submitOrder(who.owner, input);
        return json(
          { order: await customerOrder(who.owner, result.number) },
          undefined,
          result.replayed ? 200 : 201,
        );
      }
      if (action === 'resubmit' && segments.length === 2) {
        await submitOrder(who.owner, input, number);
        return json({ order: await customerOrder(who.owner, number) });
      }
      if (action === 'cancel' && segments.length === 2) {
        await cancelOrder(who.owner, number, input);
        return json({ order: await customerOrder(who.owner, number) });
      }
      if (action === 'checkout' && segments.length === 2)
        return json(await checkoutOrder(who.owner, number, input));
      if (action === 'tailor-review' && respond === 'respond' && segments.length === 3) {
        await respondToReview(who.owner, number, input);
        await dispatchNotifications(number);
        return json({ order: await customerOrder(who.owner, number) });
      }
    }
    throw new DomainError('not_found', 'Endpoint not found.', 404);
  } catch (e) {
    return failure(e);
  }
}
