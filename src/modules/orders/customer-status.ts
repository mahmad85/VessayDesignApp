export function productionLabel(status: string, payment: string, review: string) {
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'not_released')
    return payment !== 'succeeded'
      ? 'Awaiting payment'
      : ['pending', 'in_review', 'awaiting_customer'].includes(review)
        ? 'Waiting for your tailor review'
        : 'Preparing your order';
  return (
    (
      {
        released: 'In production',
        in_production: 'In production',
        quality_check: 'Final checks',
        ready_to_ship: 'Preparing shipment',
        shipped: 'Shipped',
        delivered: 'Delivered',
        completed: 'Delivered',
        on_hold: 'On hold — we may contact you',
      } as Record<string, string>
    )[status] ?? 'Preparing your order'
  );
}
export const eventLabels: Record<string, string> = {
  tracking_added: 'Shipment tracking added',
  eta_changed: 'Delivery estimate updated',
  order_submitted: 'You signed off your design and measurements',
  order_resubmitted: 'You signed off the updated design and measurements',
  order_cancelled: 'Order cancelled',
  payment_started: 'Checkout started',
  payment_succeeded: 'Payment received',
  payment_failed: 'Payment failed',
  payment_cancelled: 'Payment not completed',
  payment_refunded: 'Payment refunded',
  tailor_review_opened: 'Your tailor review started',
  tailor_review_claimed: 'A tailor is reviewing your order',
  tailor_review_decided: 'Your tailor reviewed the order',
  tailor_review_customer_responded: 'You responded to your tailor',
  order_amended: 'You accepted the measurement changes',
  tailor_review_overdue: 'Your tailor review is taking longer than expected',
};
