import { notFound } from 'next/navigation';
import { staffPage } from '@/modules/staff/page-guard';
import { OrderDesk, AdminOrderDetail } from '@/components/admin/orders';
export default async function Orders({
  params,
  searchParams,
}: {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const staff = await staffPage('orders.read'),
    parts = (await params).segments ?? [];
  if (parts.length > 1) notFound();
  const filter = new URLSearchParams(
    Object.entries(await searchParams).filter(
      (p): p is [string, string] => typeof p[1] === 'string',
    ),
  ).toString();
  return parts[0] ? (
    <AdminOrderDetail id={parts[0]} permissions={staff.permissions} />
  ) : (
    <OrderDesk initialFilter={filter} />
  );
}
