import { getDatabase } from '@/db/client';
import { sendOrderEmail } from '@/integrations/mail';
const labels: Record<string, string> = {
  payment_received:
    'Payment received. Our tailoring experts may contact you if we need any further details about your order.',
  payment_failed: 'Payment failed. Open your order to review the next step.',
  tailor_review_needs_input:
    'Your tailor has proposed measurement changes. You decide whether to accept them or keep your measurements.',
  tailor_review_completed: 'Your tailor review is complete.',
  tailor_review_delayed: 'Your tailor review is taking longer than expected.',
  order_cancelled: 'There is a cancellation update for your order. Open your order for details.',
  order_shipped: 'An item in your order has shipped. Open your order for tracking.',
};
export async function dispatchNotifications(orderNumber?: string) {
  const db = await getDatabase();
  const rows = await db.query(
    "SELECT n.id FROM notifications n JOIN orders o ON o.id=n.order_id WHERE n.status='pending' AND ($1::text IS NULL OR o.number=$1) ORDER BY n.created_at LIMIT 10",
    [orderNumber ?? null],
  );
  for (const row of rows)
    await db.transaction(async (q) => {
      const [n] = await q(
        'SELECT n.*,u.email FROM notifications n JOIN "user" u ON u.id=n.recipient_user_id WHERE n.id=$1 FOR UPDATE OF n',
        [row.id],
      );
      if (!n || n.status !== 'pending') return;
      const payload = n.payload as { number: string };
      try {
        await sendOrderEmail(
          String(n.email),
          `${payload.number}: ${String(n.purpose).replaceAll('_', ' ')}`,
          labels[String(n.purpose)] ?? 'Your order was updated.',
          `${process.env.APP_URL ?? 'http://localhost:3000'}/orders/${encodeURIComponent(payload.number)}`,
        );
        await q(
          "UPDATE notifications SET status='sent',attempts=attempts+1,sent_at=now(),last_error_code=NULL WHERE id=$1",
          [n.id],
        );
      } catch {
        await q(
          "UPDATE notifications SET status='failed',attempts=attempts+1,last_error_code='delivery_failed' WHERE id=$1",
          [n.id],
        );
        await q(
          "INSERT INTO order_events(id,order_id,type,actor,created_at) VALUES($1,$2,'notification_failed','system:notifications',clock_timestamp())",
          [crypto.randomUUID(), n.order_id],
        );
      }
    });
}
