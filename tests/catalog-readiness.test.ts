import { afterEach, describe, it, expect, vi } from 'vitest';
import { ensureCatalog, getCurrentVersion } from '../src/db/release-repository';
import { GET as ready } from '../src/app/api/ready/route';
import { PGLITE_TIMEOUT, setupTestDatabase } from './helpers/db';

// ADMIN-BACKEND.md §6 bootstrap rules and the /api/ready catalog check
// (API-REFERENCE §2). A fresh database has no release.

const database = setupTestDatabase();
afterEach(() => vi.unstubAllEnvs());

describe('catalog readiness', { timeout: PGLITE_TIMEOUT }, () => {
  it('in production without a release: 503 catalog_unavailable and not ready', async () => {
    await database();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CATALOG_AUTO_BOOTSTRAP', 'true');
    await expect(ensureCatalog()).rejects.toMatchObject({
      code: 'catalog_unavailable',
      status: 503,
    });
    const response = await ready();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'not_ready', reason: 'catalog_missing' });
    expect(await getCurrentVersion()).toBeNull();
  });

  it('outside production with auto-bootstrap switched off: also not ready', async () => {
    vi.stubEnv('CATALOG_AUTO_BOOTSTRAP', 'false');
    await expect(ensureCatalog()).rejects.toMatchObject({ code: 'catalog_unavailable' });
    expect((await ready()).status).toBe(503);
  });

  it('outside production by default: the readiness check bootstraps v1 and reports ready', async () => {
    const response = await ready();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready' });
    expect(await getCurrentVersion()).toMatchObject({ version: 1, referenceOnly: true });
    // A production instance with an existing release is ready.
    vi.stubEnv('NODE_ENV', 'production');
    expect((await ready()).status).toBe(200);
    expect(await ensureCatalog()).toBe(1);
  });
});
