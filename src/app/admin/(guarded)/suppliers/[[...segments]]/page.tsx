import { staffPage } from '@/modules/staff/page-guard';
import { Suppliers, SupplierEditor } from '@/components/admin/suppliers';
export default async function Page({ params }: { params: Promise<{ segments?: string[] }> }) {
  const staff = await staffPage('suppliers.read');
  const [id] = (await params).segments ?? [];
  return id ? (
    <SupplierEditor
      id={id}
      canWrite={staff.permissions.includes('suppliers.write')}
      canReadOrders={staff.permissions.includes('orders.read')}
    />
  ) : (
    <Suppliers canWrite={staff.permissions.includes('suppliers.write')} />
  );
}
