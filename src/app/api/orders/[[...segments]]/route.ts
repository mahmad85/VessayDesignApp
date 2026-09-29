import type { NextRequest } from 'next/server';
import { orderRoute } from '@/modules/orders/http';
export const runtime = 'nodejs';
type Context = { params: Promise<{ segments?: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  return orderRoute(request, (await context.params).segments);
}
export async function POST(request: NextRequest, context: Context) {
  return orderRoute(request, (await context.params).segments);
}
