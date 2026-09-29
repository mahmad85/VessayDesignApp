import { NextRequest } from 'next/server';
import { failure } from '@/lib/http';
import { customerCatalogJson } from '@/db/release-repository';
import { DomainError } from '@/modules/configuration/types';
export const runtime = 'nodejs';
/**
 * The customer projection of one release (CATALOG-ADMIN §9). Releases are
 * immutable and non-sensitive, so the response is cached publicly for a year.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  try {
    const { version } = await params;
    const body = /^[1-9]\d{0,8}$/.test(version) ? await customerCatalogJson(Number(version)) : null;
    if (body === null)
      throw new DomainError('not_found', 'That catalog release does not exist.', 404);
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
