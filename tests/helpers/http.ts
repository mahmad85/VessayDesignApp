import { NextRequest } from 'next/server';

// Builds requests for calling App Router handlers directly, without a server.
// The default Origin matches the default APP_URL, so checkOrigin() passes
// unless a test overrides it.

export const TEST_ORIGIN = 'http://localhost:3000';

export type TestRequestInit = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialised as the JSON body. */
  json?: unknown;
  /** `null` omits the Origin header. */
  origin?: string | null;
  /** A `Cookie` header string, or name/value pairs. */
  cookies?: string | Record<string, string>;
  headers?: Record<string, string>;
};

export function apiRequest(pathname: string, init: TestRequestInit = {}) {
  const headers = new Headers(init.headers);
  const origin = init.origin === undefined ? TEST_ORIGIN : init.origin;
  if (origin) headers.set('origin', origin);
  if (init.cookies)
    headers.set(
      'cookie',
      typeof init.cookies === 'string'
        ? init.cookies
        : Object.entries(init.cookies)
            .map(([name, value]) => `${name}=${value}`)
            .join('; '),
    );
  let body: string | undefined;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    headers.set('content-type', 'application/json');
    headers.set('content-length', String(Buffer.byteLength(body)));
  }
  return new NextRequest(new URL(pathname, TEST_ORIGIN), {
    method: init.method ?? (body === undefined ? 'GET' : 'POST'),
    headers,
    body,
  });
}

/** `name=value` pairs from a response's Set-Cookie headers, ready for the next request. */
export function cookiesFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}
