import type { NextRequest } from 'next/server';
import { json, failure } from '@/lib/http';
import { DomainError } from '@/modules/configuration/types';
import { paymentWebhook } from '@/db/payment-repository';
import { dispatchNotifications } from '@/modules/notifications/dispatch';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new DomainError('invalid_signature', 'Missing payment event.', 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256_000) {
        await reader.cancel();
        throw new DomainError('body_too_large', 'Payment event too large.', 413);
      }
      chunks.push(value);
    }
    await paymentWebhook(
      Buffer.concat(chunks).toString('utf8'),
      request.headers.get('stripe-signature') ?? '',
    );
    await dispatchNotifications();
    return json({ received: true });
  } catch (e) {
    return failure(e);
  }
}
