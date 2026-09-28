import { NextRequest } from 'next/server';
import { identity, json, failure, body, checkOrigin } from '@/lib/http';
import { getDraft, mutateDraft, enforceLimit, studioState } from '@/db/repository';
import { commandEnvelopeV2 } from '@/modules/configuration/types';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    const who = await identity(request);
    const state = await studioState(await getDraft(who.owner));
    return json(
      {
        ...state,
        user: who.user,
        assistantMode: process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL ? 'ai' : 'guided',
      },
      who.token,
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const input = commandEnvelopeV2.parse(await body(request));
    const who = await identity(request);
    await enforceLimit(who.owner + ':commands', 80);
    return json(await studioState(await mutateDraft(who.owner, input)), who.token);
  } catch (e) {
    return failure(e);
  }
}
