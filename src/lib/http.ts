import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { ZodError } from 'zod';
import { authConfigured, getAuth } from './auth';
import { claimGuest } from '@/db/repository';
import { DomainError } from '@/modules/configuration/types';
export const guestCookie = 'vessy-guest';
export async function identity(request: NextRequest) {
  const existing = request.cookies.get(guestCookie)?.value;
  const token =
    existing && /^[A-Za-z0-9_-]{43}$/.test(existing)
      ? existing
      : randomBytes(32).toString('base64url');
  const guest = 'guest:' + createHash('sha256').update(token).digest('hex');
  const session = authConfigured()
    ? await (await getAuth()).api.getSession({ headers: request.headers })
    : null;
  if (session) {
    await claimGuest(guest, `user:${session.user.id}`);
    return {
      owner: `user:${session.user.id}`,
      token,
      user: { name: session.user.name, email: session.user.email },
    };
  }
  return { owner: guest, token, user: null };
}
export function requireSignedIn(who: Awaited<ReturnType<typeof identity>>) {
  if (!who.user) throw new DomainError('sign_in_required', 'Sign in to use this feature.', 401);
  return who as typeof who & { user: NonNullable<(typeof who)['user']> };
}
export function json(data: unknown, token?: string, status = 200) {
  const r = NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (token)
    r.cookies.set(guestCookie, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  return r;
}
export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_URL || request.nextUrl.origin;
  if (!origin || origin !== new URL(expected).origin)
    throw new DomainError('invalid_origin', 'This request did not come from the studio.', 403);
}
export async function body(request: NextRequest) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 20000) throw new DomainError('body_too_large', 'The request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError('invalid_json', 'A request body is required.', 400);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 20000) {
      await reader.cancel();
      throw new DomainError('body_too_large', 'The request is too large.', 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new DomainError('invalid_json', 'The request body must be valid JSON.', 400);
  }
}
export function failure(error: unknown) {
  if (error instanceof DomainError)
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      undefined,
      error.status,
    );
  if (error instanceof ZodError)
    return json(
      { error: { code: 'invalid_input', message: 'Please check your selections and try again.' } },
      undefined,
      422,
    );
  console.error('Vessy request failed:', error instanceof Error ? error.name : 'unknown');
  return json(
    {
      error: {
        code: 'temporarily_unavailable',
        message:
          'The studio could not save this change. Your previous draft is safe; please try again.',
      },
    },
    undefined,
    503,
  );
}
