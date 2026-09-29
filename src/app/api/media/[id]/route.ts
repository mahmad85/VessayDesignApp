import { NextRequest } from 'next/server';
import { failure } from '@/lib/http';
import { getMediaAsset } from '@/db/media-repository';
import { DomainError } from '@/modules/configuration/types';
export const runtime = 'nodejs';
/**
 * Catalog media (ADMIN-BACKEND §9). Imported reference images live under
 * /public, so the static driver answers with a permanent redirect; uploaded
 * media (the local and object-store drivers) are served from WP-22 on.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const media = /^[0-9a-f-]{8,64}$/.test(id) ? await getMediaAsset(id) : null;
    if (!media || media.storageDriver !== 'static' || !media.storageKey.startsWith('/'))
      throw new DomainError('not_found', 'That image does not exist.', 404);
    return new Response(null, {
      status: 308,
      headers: {
        Location: new URL(media.storageKey, request.url).toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
