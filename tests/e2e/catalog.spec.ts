import { expect, test } from '@playwright/test';

// TASK-015: the readiness check covers the catalog. Outside production the
// first check publishes catalog v1 from the reference data (auto-bootstrap),
// so a development server reports ready. Synthetic test environment only.

test('readiness includes the catalog release and stays uncached', async ({ request }) => {
  const response = await request.get('/api/ready', { timeout: 60000 });
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toEqual({ status: 'ready' });
  // Idempotent: a second check does not publish again and stays ready.
  expect((await request.get('/api/ready')).status()).toBe(200);
});
