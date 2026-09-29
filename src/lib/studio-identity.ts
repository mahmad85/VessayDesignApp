import type { NextRequest } from 'next/server';
import { identity } from './http';
import { requireStaff } from '@/modules/staff/authorize';
export async function studioIdentity(request: NextRequest) {
  if (request.nextUrl.searchParams.get('catalog') !== 'working')
    return { ...(await identity(request)), isPreview: false };
  const staff = await requireStaff(request, 'catalog.read');
  return {
    owner: `preview:user:${staff.userId}`,
    token: undefined,
    user: staff.user,
    isPreview: true,
  };
}
