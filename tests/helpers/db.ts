import { beforeAll } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getDatabase } from '../../src/db/client';

// One embedded PGlite database per test file. Vitest runs each file in its own
// worker, so the cached connection in src/db/client.ts never crosses files.
// Every migration runs on connect, exactly as in local development.

export async function createTestDatabaseDirectory(prefix = 'vessy-test-') {
  return mkdtemp(path.join(tmpdir(), prefix));
}

/** Points the application database at a fresh temporary directory before the file's tests. */
export function setupTestDatabase(prefix?: string) {
  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    process.env.VESSY_DEV_DATABASE_PATH = await createTestDatabaseDirectory(prefix);
  });
  return () => getDatabase();
}
