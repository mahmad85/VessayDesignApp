import { notFound } from 'next/navigation';
import { staffPage } from '@/modules/staff/page-guard';
import { CustomerLookup } from '@/components/admin/operations';
export default async function Customers({ params }: { params: Promise<{ segments?: string[] }> }) {
  await staffPage('customers.read');
  const parts = (await params).segments ?? [];
  if (parts.length > 1) notFound();
  return <CustomerLookup id={parts[0]} />;
}
