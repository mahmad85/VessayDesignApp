import { NextRequest } from 'next/server';
import { identity, json, failure, checkOrigin, requireSignedIn } from '@/lib/http';
import { providerScanAuthorizationReadiness } from '@/lib/scan-service-policy';
export const runtime = 'nodejs';
// This branch intentionally stays unreachable until 3DLOOK supplies a
// private, single-use scan-authorization capability
// (providerScanAuthorizationReadiness). Do not create a Stripe charge before
// that boundary exists (docs/integrations/3DLOOK.md, INT-002); building the
// design/revision-ownership and idempotency-key validation that would follow
// the readiness gate is deferred until the gate can actually open.
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    requireSignedIn(await identity(request));
    const readiness = providerScanAuthorizationReadiness();
    return json(
      {
        error: 'Paid AI measurement scanning is not available yet because secure one-use provider authorization is not configured.',
        code: readiness.code,
        required: readiness.required,
      },
      undefined,
      503,
    );
  } catch (e) {
    return failure(e);
  }
}
