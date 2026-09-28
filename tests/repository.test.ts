import { describe, it, expect } from 'vitest';
import { getDraft, mutateDraft, claimGuest, enforceLimit } from '../src/db/repository';
import { PGLITE_TIMEOUT, setupTestDatabase } from './helpers/db';
setupTestDatabase();
describe('durable owned drafts', { timeout: PGLITE_TIMEOUT }, () => {
  it('isolates owners and returns persisted state on reload', async () => {
    const a = await getDraft('test:a'),
      b = await getDraft('test:b');
    expect(a.id).not.toBe(b.id);
    await mutateDraft('test:a', {
      actionId: crypto.randomUUID(),
      expectedRevision: 0,
      command: { type: 'design', patch: { fabricId: 'forest' } },
    });
    expect((await getDraft('test:a')).design.fabricId).toBe('forest');
    expect((await getDraft('test:b')).design.fabricId).toBe('navy-twill');
  });
  it('replays an action once and rejects a reused action identifier with different content', async () => {
    const d = await getDraft('test:replay');
    const input = {
      actionId: crypto.randomUUID(),
      expectedRevision: d.revision,
      command: { type: 'design' as const, patch: { fabricId: 'charcoal' } },
    };
    const result = await mutateDraft('test:replay', input);
    expect(await mutateDraft('test:replay', input)).toEqual(result);
    await expect(
      mutateDraft('test:replay', {
        ...input,
        command: { type: 'design', patch: { fabricId: 'forest' } },
      }),
    ).rejects.toMatchObject({ code: 'action_conflict' });
    expect((await getDraft('test:replay')).revision).toBe(1);
  });
  it('allows only one of two concurrent edits against the same revision', async () => {
    const d = await getDraft('test:race');
    const results = await Promise.allSettled(
      ['forest', 'charcoal'].map((id) =>
        mutateDraft('test:race', {
          actionId: crypto.randomUUID(),
          expectedRevision: d.revision,
          command: { type: 'design', patch: { fabricId: id } },
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await getDraft('test:race')).revision).toBe(1);
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
