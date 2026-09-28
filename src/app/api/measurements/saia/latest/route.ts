import { NextRequest } from 'next/server';
import { identity, json, failure, requireSignedIn } from '@/lib/http';
import { getLatestSaiaDraft } from '@/db/saia-repository';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    const who = requireSignedIn(await identity(request));
    const draft = await getLatestSaiaDraft(who.owner);
    return json({ draft }, who.token);
  } catch (e) {
    return failure(e);
  }
}
