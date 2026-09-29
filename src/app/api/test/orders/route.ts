import { NextRequest } from 'next/server';
import { z } from 'zod';
import { identity, requireSignedIn, body, checkOrigin, json, failure } from '@/lib/http';
import { getDatabase } from '@/db/client';
import { DomainError } from '@/modules/configuration/types';
import { e2eHooksEnabled } from '@/db/e2e-catalog';
import { isPaymentTestRuntime } from '@/integrations/payments/test-runtime';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    if (!e2eHooksEnabled() || !isPaymentTestRuntime() || process.env.PAYMENT_PROVIDER !== 'fake')
      throw new DomainError('not_found', 'Not found.', 404);
    checkOrigin(request);
    const who = requireSignedIn(await identity(request));
    if (!who.user.email.endsWith('@vessy.invalid'))
      throw new DomainError('not_found', 'Not found.', 404);
    const { number } = z
      .object({ number: z.string().max(30) })
      .strict()
      .parse(await body(request));
    const [p] = await (
      await getDatabase()
    ).query(
      "SELECT p.* FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.number=$1 AND o.owner=$2 AND p.provider='fake' ORDER BY p.created_at DESC LIMIT 1",
      [number, who.owner],
    );
    if (!p) throw new DomainError('not_found', 'Not found.', 404);
    return json({
      id: 'evt_SYNTHETIC_' + crypto.randomUUID(),
      object: 'event',
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: p.provider_session_id,
          object: 'checkout.session',
          status: 'complete',
          payment_status: 'paid',
          amount_total: p.amount_minor,
          currency: String(p.currency).toLowerCase(),
          payment_intent: 'pi_SYNTHETIC_' + p.id,
          metadata: {
            kind: 'garment_order',
            orderId: p.order_id,
            paymentId: p.id,
            snapshotVersion: String(p.snapshot_version),
          },
        },
      },
    });
  } catch (e) {
    return failure(e);
  }
}
