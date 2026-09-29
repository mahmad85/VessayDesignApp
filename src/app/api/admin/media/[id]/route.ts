import type { NextRequest } from 'next/server';
import { adminRoute, adminBody, json } from '@/lib/admin-http';
import { editMedia } from '@/db/media-repository';
export const runtime = 'nodejs';
export const PATCH = (r: NextRequest, c: { params: Promise<{ id: string }> }) =>
  adminRoute(r, 'catalog.write', async (s) =>
    json(await editMedia((await c.params).id, await adminBody(r), s.actor)),
  );
