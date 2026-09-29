import type { NextRequest } from 'next/server';
import { adminRoute, adminBody, json } from '@/lib/admin-http';
import { orderLookups } from '@/db/lookup-repository';
export const runtime = 'nodejs';
export const POST = (r: NextRequest, c: { params: Promise<{ typeCode: string }> }) =>
  adminRoute(r, 'catalog.write', async (s) =>
    json(await orderLookups((await c.params).typeCode, await adminBody(r), s.actor)),
  );
