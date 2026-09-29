import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getStaffContext } from './authorize';
import type { Permission } from './permissions';
export async function staffPage(permission?: Permission, enrollment = false) {
  const staff = await getStaffContext(await headers());
  if (!staff) redirect('/account?next=/admin');
  if (!staff.roles.length) notFound();
  if (!enrollment && staff.mfa.required && !staff.mfa.enabled) redirect('/admin/security');
  if (permission && !staff.permissions.includes(permission)) notFound();
  return staff;
}
