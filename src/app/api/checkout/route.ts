import { NextRequest } from 'next/server';
import { identity, failure, checkOrigin } from '@/lib/http';
import { getDraft } from '@/db/repository';
import { beginCheckout } from '@/integrations/checkout';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const who = await identity(request);
    return await beginCheckout(await getDraft(who.owner));
  } catch (e) {
    return failure(e);
  }
}
