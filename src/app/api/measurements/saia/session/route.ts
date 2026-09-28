import { NextRequest } from 'next/server';
import { identity, json, failure, body, checkOrigin, requireSignedIn } from '@/lib/http';
import { enforceLimit } from '@/db/repository';
import { createPublicSaiaSession, createPaidSaiaSession } from '@/db/saia-repository';
import { providerScanAuthorizationReadiness } from '@/lib/scan-service-policy';
import { DomainError } from '@/modules/configuration/types';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const input = (await body(request)) as { targetUnit?: unknown; mode?: unknown };
    if (input.targetUnit !== 'cm' && input.targetUnit !== 'in')
      throw new DomainError('invalid_input', 'A supported target unit is required.', 400);
    const who = requireSignedIn(await identity(request));
    await enforceLimit(who.owner + ':saia-session', 20);
    const mode = input.mode === 'paid' ? 'paid' : 'public';
    if (mode === 'paid') {
      const readiness = providerScanAuthorizationReadiness();
      if (!readiness.ready)
        throw new DomainError(
          readiness.code,
          'Paid single-use AI scans are unavailable until secure one-use provider authorization is configured.',
          503,
        );
      const draft = await createPaidSaiaSession(who.owner, input.targetUnit);
      return json({ draft }, who.token, 201);
    }
    const draft = await createPublicSaiaSession(who.owner, input.targetUnit);
    return json({ draft }, who.token, 201);
  } catch (e) {
    return failure(e);
  }
}
