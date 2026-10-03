import { NextRequest } from 'next/server';
import { failure } from '@/lib/http';
import { getMediaAsset } from '@/db/media-repository';
import { DomainError } from '@/modules/configuration/types';
import { getStorage } from '@/integrations/storage';
import { staticPath } from '@/integrations/storage/static';
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
    if (!media) throw new DomainError('not_found', 'That image does not exist.', 404);
    if (media.storageDriver !== 'static') {
      const file = await getStorage(media.storageDriver).get(media.storageKey);
      if (!file) throw new DomainError('not_found', 'That image does not exist.', 404);
      return new Response(Buffer.from(file.bytes), {
        headers: {
          'Content-Type': media.contentType,
          'Content-Length': String(file.bytes.length),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'",
        },
      });
    }
    return new Response(null, {
      status: 308,
      headers: {
        // Relative, so the browser keeps the host it used: behind `next dev --hostname
        // 0.0.0.0` an absolute URL from request.url points at 0.0.0.0, which browsers refuse.
        Location: staticPath(media.storageKey),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
