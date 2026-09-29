import type { NextRequest } from 'next/server';
import { catalogDispatch } from '@/modules/catalog/admin-dispatch';
export const runtime = 'nodejs';
type Context = { params: Promise<{ segments: string[] }> };
async function handler(request: NextRequest, context: Context) {
  return catalogDispatch(request, (await context.params).segments);
}
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
