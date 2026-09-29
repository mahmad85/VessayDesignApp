import { staffPage } from '@/modules/staff/page-guard';
import { AdminShell } from '@/components/admin/shell';
export default async function Layout({ children }: { children: React.ReactNode }) {
  return <AdminShell staff={await staffPage()}>{children}</AdminShell>;
}
