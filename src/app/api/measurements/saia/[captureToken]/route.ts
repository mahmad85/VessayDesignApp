import { NextRequest } from 'next/server';
import { identity, json, failure, body, checkOrigin, requireSignedIn } from '@/lib/http';
import { enforceLimit } from '@/db/repository';
import { saveSaiaDraftResult, markSaiaDraftFailed } from '@/db/saia-repository';
import {
  mapSaiaPersonToMillimeters,
  extractRawSaiaDimensions,
  type SaiaPerson,
} from '@/integrations/3dlook';
import {
  normalizeSaiaDraftMeasurements,
  sanitizeProviderPersonId,
  fingerprintSaiaProviderResult,
  saiaFingerprintSecret,
} from '@/lib/saia-draft';
import { DomainError } from '@/modules/configuration/types';
export const runtime = 'nodejs';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ captureToken: string }> },
) {
  const { captureToken } = await params;
  let who: Awaited<ReturnType<typeof identity>> | undefined;
  try {
    checkOrigin(request);
    who = requireSignedIn(await identity(request));
    await enforceLimit(who.owner + ':saia-draft', 20);
    const input = (await body(request)) as { person?: unknown };
    const person = (
      input.person && typeof input.person === 'object' ? input.person : {}
    ) as SaiaPerson;
    const providerPersonId = sanitizeProviderPersonId(person.id);
    const providerResultFingerprint = fingerprintSaiaProviderResult(
      who.owner,
      providerPersonId,
      await saiaFingerprintSecret(),
    );
    const measurements = normalizeSaiaDraftMeasurements(mapSaiaPersonToMillimeters(person));
    const sourceDimensions = extractRawSaiaDimensions(person);
    const draft = await saveSaiaDraftResult(who.owner, captureToken, {
      providerResultFingerprint,
      measurements,
      sourceDimensions,
    });
    return json({ draft }, who.token);
  } catch (e) {
    const code = e instanceof Error ? e.message : 'capture_failed';
    if (who) await markSaiaDraftFailed(who.owner, captureToken, code).catch(() => undefined);
    if (e instanceof DomainError) return failure(e);
    const status = code === 'draft_not_found' ? 404 : 422;
    return failure(
      new DomainError(code, 'The 3DLOOK result could not be saved as a review draft.', status),
    );
  }
}
