import { staffPage } from '@/modules/staff/page-guard';
import { SecuritySetup } from '@/components/admin/security';
export default async function Security() {
  const staff = await staffPage(undefined, true);
  return <SecuritySetup enabled={staff.mfa.enabled} />;
}
