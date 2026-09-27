import { NextRequest } from 'next/server';
import { identity, json, failure, checkOrigin } from '@/lib/http';
import { beginCapture } from '@/integrations/3dlook';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    await identity(request);
    return json(await beginCapture(), undefined, 503);
  } catch (e) {
    return failure(e);
  }
}
