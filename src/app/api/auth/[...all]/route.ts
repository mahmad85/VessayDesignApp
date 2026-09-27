import { NextRequest } from 'next/server';
import { getAuth } from '@/lib/auth';
import { failure } from '@/lib/http';
export const runtime = 'nodejs';
async function handler(request: NextRequest) {
  try {
    return await (await getAuth()).handler(request);
  } catch (e) {
    return failure(e);
  }
}
export { handler as GET, handler as POST };
