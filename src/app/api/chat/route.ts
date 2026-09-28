import { NextRequest } from 'next/server';
import { z } from 'zod';
import { identity, json, failure, body, checkOrigin } from '@/lib/http';
import { getDraft, saveChat, replayChat, enforceLimit, studioState } from '@/db/repository';
import { assistantReply } from '@/integrations/assistant';
import { DomainError } from '@/modules/configuration/types';
export const runtime = 'nodejs';
const inputSchema = z.object({
  actionId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  message: z.string().trim().min(1).max(1500),
});
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const input = inputSchema.parse(await body(request));
    const who = await identity(request);
    const replay = await replayChat(who.owner, input);
    if (replay) return json(await studioState(replay), who.token);
    await enforceLimit(who.owner + ':chat', 12);
    await enforceLimit('assistant:global', 80);
    const current = await getDraft(who.owner);
    if (current.revision !== input.expectedRevision)
      throw new DomainError(
        'revision_conflict',
        'Your draft has changed. Please send your message again.',
        409,
      );
    const answer = await assistantReply(current, input.message);
    const draft = await saveChat(who.owner, input, {
      id: crypto.randomUUID(),
      role: 'assistant',
      ...answer,
      basisRevision: current.revision + 1,
      createdAt: new Date().toISOString(),
    });
    return json(await studioState(draft), who.token);
  } catch (e) {
    return failure(e);
  }
}
