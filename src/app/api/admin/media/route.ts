import type { NextRequest } from 'next/server';
import { adminRoute, json } from '@/lib/admin-http';
import { listMedia, uploadMedia } from '@/db/media-repository';
export const runtime = 'nodejs';
export const GET = (r: NextRequest) =>
  adminRoute(r, 'catalog.read', async () =>
    json(await listMedia(Object.fromEntries(r.nextUrl.searchParams))),
  );
export const POST = (r: NextRequest) =>
  adminRoute(r, 'catalog.write', async (s) => json(await uploadMedia(r, s.actor), undefined, 201), {
    limit: 'media',
  });
