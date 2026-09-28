import { NextRequest } from 'next/server';
import { identity, json, failure, body, checkOrigin } from '@/lib/http';
import { getDraft, mutateDraft, enforceLimit } from '@/db/repository';
import { commandEnvelopeV2 } from '@/modules/configuration/types';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    const who = await identity(request);
    const draft = await getDraft(who.owner);
    return json(
      {
        draft,
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
    const draft = await mutateDraft(who.owner, input);
    return json({ draft }, who.token);
  } catch (e) {
    return failure(e);
  }
}
