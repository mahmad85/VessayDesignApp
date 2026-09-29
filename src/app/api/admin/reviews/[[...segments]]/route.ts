import { json } from '@/lib/http';
import type { NextRequest } from 'next/server';
import { adminRoute, adminBody } from '@/lib/admin-http';
import { reviewQueue, reviewDetail, claimReview, decideReview } from '@/db/order-repository';
import { DomainError } from '@/modules/configuration/types';
import { dispatchNotifications } from '@/modules/notifications/dispatch';
export const runtime = 'nodejs';
type Context = { params: Promise<{ segments?: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  return adminRoute(request, 'reviews.read', async (staff) => {
    const [id, ...rest] = (await context.params).segments ?? [];
    if (rest.length) throw new DomainError('not_found', 'Review not found.', 404);
    return json(
      id
        ? await reviewDetail(id)
        : await reviewQueue(staff.user.id, Object.fromEntries(request.nextUrl.searchParams)),
    );
  });
}
export async function POST(request: NextRequest, context: Context) {
  return adminRoute(request, 'reviews.decide', async (staff) => {
    const [id, action, ...rest] = (await context.params).segments ?? [];
    if (!id || rest.length || !['claim', 'decision'].includes(action))
      throw new DomainError('not_found', 'Action not found.', 404);
    const input = await adminBody(request),
      result =
        action === 'claim'
          ? await claimReview(id, staff.user.id, input)
          : await decideReview(id, staff.user.id, input);
    await dispatchNotifications(result.snapshot.number);
    return json(result);
  });
}
