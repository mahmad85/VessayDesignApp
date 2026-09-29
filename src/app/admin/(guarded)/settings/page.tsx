import { staffPage } from '@/modules/staff/page-guard';
import { StaffSettings } from '@/components/admin/staff-settings';
import { CommerceSettings } from '@/components/admin/pricing';
export default async function Settings() {
  await staffPage('staff.manage');
  return (
    <>
      <CommerceSettings canWrite />
      <StaffSettings />
    </>
  );
}
