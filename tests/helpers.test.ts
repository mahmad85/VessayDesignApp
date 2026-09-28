import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { PGLITE_TIMEOUT, setupTestDatabase } from './helpers/db';
import { apiRequest, cookiesFrom } from './helpers/http';
import { createSyntheticUser } from './helpers/users';
import { GET as getStudio, POST as postStudio } from '../src/app/api/studio/route';

// Smoke tests for the shared helpers. Synthetic data only.
const database = setupTestDatabase();

describe('test helpers', { timeout: PGLITE_TIMEOUT }, () => {
  it('opens a migrated database in a temporary directory', async () => {
    expect(process.env.VESSY_DEV_DATABASE_PATH?.startsWith(tmpdir())).toBe(true);
    const db = await database();
    const [row] = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM drafts');
    expect(row.n).toBe(0);
  });

  it('builds route-handler requests with origin, cookies and a JSON body', async () => {
    const first = await getStudio(apiRequest('/api/studio'));
    expect(first.status).toBe(200);
    const guest = cookiesFrom(first);
    expect(guest).toMatch(/^vessy-guest=/);
    const { draft } = await first.json();
    const again = await (await getStudio(apiRequest('/api/studio', { cookies: guest }))).json();
    expect(again.draft.id).toBe(draft.id);
    const input = {
      actionId: crypto.randomUUID(),
      expectedRevision: draft.revision,
      command: { type: 'add_garment', productCode: 'suit' },
    };
    const rejected = await postStudio(
      apiRequest('/api/studio', { json: input, cookies: guest, origin: 'https://evil.invalid' }),
    );
    expect(rejected.status).toBe(403);
    expect((await rejected.json()).error.code).toBe('invalid_origin');
    const added = await postStudio(apiRequest('/api/studio', { json: input, cookies: guest }));
    expect(added.status).toBe(200);
    const fabric = {
      actionId: crypto.randomUUID(),
      expectedRevision: draft.revision + 1,
      command: { type: 'design', patch: { materialCode: 'forest' } },
    };
    const saved = await postStudio(apiRequest('/api/studio', { json: fabric, cookies: guest }));
    expect(saved.status).toBe(200);
    expect((await saved.json()).draft.garments[0].materialCode).toBe('forest');
  });

  it('creates a verified synthetic user with a working session cookie', async () => {
    const user = await createSyntheticUser();
    expect(user.email).toMatch(/@vessy\.invalid$/);
    const response = await getStudio(apiRequest('/api/studio', { cookies: user.cookie }));
    const body = await response.json();
    expect(body.user).toEqual({ name: user.name, email: user.email });
    const db = await database();
    const [owned] = await db.query('SELECT owner FROM drafts WHERE id=$1', [body.draft.id]);
    expect(owned.owner).toBe(`user:${user.userId}`);
  });

  it('can leave a synthetic user unverified', async () => {
    const user = await createSyntheticUser({ verified: false });
    expect(user.cookie).toBe('');
    const db = await database();
    const [row] = await db.query('SELECT email_verified FROM "user" WHERE id=$1', [user.userId]);
    expect(row.email_verified).toBe(false);
  });
});
