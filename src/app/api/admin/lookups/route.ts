import type { NextRequest } from 'next/server';
import { adminRoute, json } from '@/lib/admin-http';
import { getLookups } from '@/db/lookup-repository';
export const runtime = 'nodejs';
export const GET = (r: NextRequest) =>
  adminRoute(r, 'catalog.read', async () => json(await getLookups()));
