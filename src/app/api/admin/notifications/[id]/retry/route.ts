import type { NextRequest } from 'next/server';
import { adminRoute, json } from '@/lib/admin-http';
import { retryNotification } from '@/db/fulfillment-repository';
import { dispatchNotifications } from '@/modules/notifications/dispatch';
import { getDatabase } from '@/db/client';
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return adminRoute(request, 'orders.notifications.retry', async (staff) => {
    const { id } = await params,
      number = await retryNotification(id, staff.actor);
    await dispatchNotifications(number);
    const [n] = await (
      await getDatabase()
    ).query('SELECT status FROM notifications WHERE id=$1', [id]);
    return json({ status: n.status });
  });
}
