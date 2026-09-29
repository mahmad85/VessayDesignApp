import type { NextRequest } from 'next/server';
import { identity, checkOrigin, body, json, failure } from '@/lib/http';
import { enforceLimit, studioState } from '@/db/repository';
import { runOrderCheck } from '@/db/order-repository';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const who = await identity(request);
    await enforceLimit(`${who.owner}:order-check`, 10);
    return json(await studioState(await runOrderCheck(who.owner, await body(request))), who.token);
  } catch (e) {
    return failure(e);
  }
}
