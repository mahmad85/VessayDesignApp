import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import fixture from './fixtures/drafts-v1.synthetic.json';
import {
  getDraft,
  getRevision,
  mutateDraft,
  claimGuest,
  enforceLimit,
  replayChat,
} from '../src/db/repository';
import type { CommandV2, DraftV2 } from '../src/modules/configuration/types';
import { PGLITE_TIMEOUT, setupTestDatabase } from './helpers/db';

// Owned drafts on the v2 engine, with v1 JSON upgraded on every read path
// (ADMIN-BACKEND §7.2). Ported from the v1 repository tests (WP-12): each v1
// assertion keeps a v2 equivalent. SYNTHETIC owners and drafts only.

const database = setupTestDatabase();
const addSuit: CommandV2 = { type: 'add_garment', productCode: 'suit' };
const material = (materialCode: string): CommandV2 => ({ type: 'design', patch: { materialCode } });
const command = (owner: string, expectedRevision: number, c: CommandV2) =>
  mutateDraft(owner, { actionId: crypto.randomUUID(), expectedRevision, command: c });
const active = (draft: DraftV2) => draft.garments.find((g) => g.id === draft.activeGarmentId);
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function insertV1(owner: string, name: keyof typeof fixture.drafts) {
  const v1 = structuredClone(fixture.drafts[name]);
  v1.id = crypto.randomUUID();
  const db = await database();
  await db.query('INSERT INTO drafts(id,owner,revision,data) VALUES($1,$2,$3,$4)', [
    v1.id,
    owner,
    v1.revision,
    JSON.stringify(v1),
  ]);
  return v1;
}

describe('durable owned drafts', { timeout: PGLITE_TIMEOUT }, () => {
  it('isolates owners and returns persisted state on reload', async () => {
    const a = await getDraft('test:a'),
      b = await getDraft('test:b');
    expect(a.id).not.toBe(b.id);
    // New drafts start with an empty cart (the start screen).
    expect(a).toMatchObject({ schemaVersion: 2, garments: [], activeGarmentId: null });
    await command('test:a', 0, addSuit);
    await command('test:a', 1, material('forest'));
    expect(active(await getDraft('test:a'))?.materialCode).toBe('forest');
    expect((await getDraft('test:b')).garments).toEqual([]);
  });

  it('replays an action once and rejects a reused action identifier with different content', async () => {
    await getDraft('test:replay');
    await command('test:replay', 0, addSuit);
    const d = await getDraft('test:replay');
    const input = {
      actionId: crypto.randomUUID(),
      expectedRevision: d.revision,
      command: material('charcoal'),
    };
    const result = await mutateDraft('test:replay', input);
    expect(await mutateDraft('test:replay', input)).toEqual(result);
    await expect(
      mutateDraft('test:replay', { ...input, command: material('forest') }),
    ).rejects.toMatchObject({ code: 'action_conflict' });
    expect((await getDraft('test:replay')).revision).toBe(2);
  });

  it('allows only one of two concurrent edits against the same revision', async () => {
    await getDraft('test:race');
    await command('test:race', 0, addSuit);
    const d = await getDraft('test:race');
    const results = await Promise.allSettled(
      ['forest', 'charcoal'].map((id) => command('test:race', d.revision, material(id))),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await getDraft('test:race')).revision).toBe(2);
  });

  it('claims a guest draft without overwriting an existing account draft', async () => {
    const guest = await getDraft('test:guest');
    await claimGuest('test:guest', 'test:registered');
    expect((await getDraft('test:registered')).id).toBe(guest.id);
    const other = await getDraft('test:other-guest');
    await claimGuest('test:other-guest', 'test:registered');
    expect((await getDraft('test:registered')).id).toBe(guest.id);
    expect((await getDraft('test:other-guest')).id).toBe(other.id);
  });

  it('enforces a shared database rate limit', async () => {
    await enforceLimit('test:rate', 1);
    await expect(enforceLimit('test:rate', 1)).rejects.toMatchObject({ code: 'rate_limited' });
  });
});

describe('v1 drafts upgraded on read', { timeout: PGLITE_TIMEOUT }, () => {
  it('reads a stored v1 draft as v2 and persists v2 with the next command', async () => {
    const v1 = await insertV1('test:v1-draft', 'suitEdited');
    const read = await getDraft('test:v1-draft');
    expect(read).toMatchObject({ schemaVersion: 2, id: v1.id, revision: v1.revision });
    expect(active(read)).toMatchObject({ id: v1.id, productCode: 'suit', materialCode: 'forest' });
    const db = await database();
    const [stored] = await db.query<{ data: { schemaVersion?: number } }>(
      'SELECT data FROM drafts WHERE owner=$1',
      ['test:v1-draft'],
    );
    expect(stored.data.schemaVersion).toBeUndefined();
    const next = await command('test:v1-draft', v1.revision, material('charcoal'));
    expect(active(next)?.materialCode).toBe('charcoal');
    const [after] = await db.query<{ data: { schemaVersion?: number } }>(
      'SELECT data FROM drafts WHERE owner=$1',
      ['test:v1-draft'],
    );
    expect(after.data.schemaVersion).toBe(2);
    // The stored revision keeps the v1 JSON and is upgraded when read.
    const [revision] = await db.query<{ data: { design?: unknown } }>(
      'SELECT r.data FROM revisions r WHERE r.draft_id=$1 AND r.revision=$2',
      [v1.id, v1.revision],
    );
    expect(revision.data.design).toBeDefined();
    expect(await getRevision('test:v1-draft', v1.revision)).toEqual(read);
    expect(await getRevision('test:v1-draft', 999)).toBeNull();
  });

  it('upgrades a replayed v1 action result', async () => {
    const v1 = await insertV1('test:v1-action', 'shirtEdited');
    const input = {
      actionId: crypto.randomUUID(),
      expectedRevision: v1.revision,
      command: material('sky'),
    };
    const db = await database();
    await db.query('INSERT INTO actions(id,draft_id,fingerprint,result) VALUES($1,$2,$3,$4)', [
      input.actionId,
      v1.id,
      fingerprint(input),
      JSON.stringify(v1),
    ]);
    const replay = await mutateDraft('test:v1-action', input);
    expect(replay).toMatchObject({ schemaVersion: 2, id: v1.id });
    expect(active(replay)).toMatchObject({
      productCode: 'shirt',
      selections: { 'style.shirt.shirt_collar.shirt-collar': 'point' },
    });
    const chat = { actionId: crypto.randomUUID(), expectedRevision: v1.revision, message: 'Hello' };
    await db.query('INSERT INTO actions(id,draft_id,fingerprint,result) VALUES($1,$2,$3,$4)', [
      chat.actionId,
      v1.id,
      fingerprint({ ...chat, kind: 'chat' }),
      JSON.stringify(v1),
    ]);
    expect((await replayChat('test:v1-action', chat))?.schemaVersion).toBe(2);
  });
});
