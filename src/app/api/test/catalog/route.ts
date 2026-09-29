import { NextRequest } from 'next/server';
import { z } from 'zod';
import { body, checkOrigin, failure, json } from '@/lib/http';
import { e2eHooksEnabled, publishE2ECatalog } from '@/db/e2e-catalog';
import { DomainError } from '@/modules/configuration/types';
export const runtime = 'nodejs';
const input = z.object({ scenario: z.enum(['priced', 'reference']) }).strict();
/**
 * Browser-test hook (never in production; off unless VESSY_E2E_HOOKS=true):
 * publish SYNTHETIC prices on the current release, or restore the reference
 * release, on the Playwright database.
 */
export async function POST(request: NextRequest) {
  try {
    if (!e2eHooksEnabled()) throw new DomainError('not_found', 'Not found.', 404);
    checkOrigin(request);
    const { scenario } = input.parse(await body(request));
    return json(await publishE2ECatalog(scenario));
  } catch (e) {
    return failure(e);
  }
}
