import { OrderDetail } from '@/components/orders';
export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  return <OrderDetail number={(await params).number} />;
}
