import type { NextRequest } from 'next/server';
import { adminRoute, adminBody, json } from '@/lib/admin-http';
import { commerceSettings, saveCommerce } from '@/db/pricing-admin-repository';
export const runtime = 'nodejs';
export const GET = (r: NextRequest) =>
  adminRoute(r, 'catalog.read', async () => json(await commerceSettings()));
export const PATCH = (r: NextRequest) =>
  adminRoute(r, 'settings.write', async (s) =>
    json(await saveCommerce(await adminBody(r), `user:${s.userId}`)),
  );
