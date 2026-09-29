import { createHash } from 'node:crypto';
import { getDatabase } from './client';
import { ensureCatalog, getRelease } from './release-repository';
import { getAvailability } from './availability';
import {
  applyCommand,
  catalogUpdates,
  createDraft,
  pinnedVersions,
  type EngineContext,
} from '@/modules/configuration/engine';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import { upgradeDraft } from '@/modules/configuration/upgrade';
import {
  DomainError,
  type ChatMessageV2,
  type CommandV2,
  type DraftV1,
  type DraftV2,
  type Impact,
} from '@/modules/configuration/types';
import type { AvailabilityMap } from '@/modules/catalog/garment';
import { quoteCart, type CartQuote } from '@/modules/pricing/quote';

// Owned drafts (one per owner). Every read path — the draft row, a replayed
// action result and a stored revision — upgrades v1 JSON to v2 on read
// (ADMIN-BACKEND.md §7.2); the upgraded form is persisted by the next
// successful command. Stored revisions keep the JSON exactly as it was.

const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read = (data: unknown) => upgradeDraft(data as DraftV1 | DraftV2);

/**
 * The engine context: the current release (bootstrapped outside production),
 * the releases the given garment versions are pinned to, and the live fabric
 * availability overlay. Releases are read before the draft transaction,
 * because PGlite serialises every query behind an open transaction.
 */
export async function loadEngineContext(versions: readonly number[] = []): Promise<EngineContext> {
  const currentVersion = await ensureCatalog();
  const releases = new Map<number, RuntimeIndex>();
  for (const version of new Set([currentVersion, ...versions])) {
    const release = await getRelease(version);
    if (release) releases.set(version, release.index);
  }
  const current = releases.get(currentVersion);
  if (!current)
    throw new DomainError(
      'catalog_unavailable',
      'The catalog is not available yet. Please try again later.',
      503,
    );
  return { current, releases, availability: await getAvailability() };
}

/** The studio envelope around a draft (ADMIN-BACKEND §7.1, API-REFERENCE §2.2). */
export type StudioState = {
  draft: DraftV2;
  catalogVersion: number;
  catalogUpdates: { garmentId: string; impact: Impact[] }[];
  /** The live cart quote on the current release (PRC-004); never persisted here. */
  quote: CartQuote;
  availability: AvailabilityMap;
};

export async function studioState(draft: DraftV2): Promise<StudioState> {
  const context = await loadEngineContext(pinnedVersions(draft));
  return {
    draft,
    catalogVersion: context.current.catalog.version,
    catalogUpdates: catalogUpdates(context, draft),
    quote: quoteCart(context.current, draft, context.availability),
    availability: context.availability ?? {},
  };
}

export async function getDraft(owner: string): Promise<DraftV2> {
  const db = await getDatabase();
  const draft = createDraft();
  await db.query(
    'INSERT INTO drafts(id,owner,revision,data) VALUES($1,$2,0,$3) ON CONFLICT(owner) DO NOTHING',
    [draft.id, owner, JSON.stringify(draft)],
  );
  const rows = await db.query('SELECT data FROM drafts WHERE owner=$1', [owner]);
  return read(rows[0].data);
}

/** A stored revision of the owner's draft, upgraded on read. */
export async function getRevision(owner: string, revision: number): Promise<DraftV2 | null> {
  const db = await getDatabase();
  const rows = await db.query(
    'SELECT r.data FROM revisions r JOIN drafts d ON d.id=r.draft_id WHERE d.owner=$1 AND r.revision=$2',
    [owner, revision],
  );
  return rows.length ? read(rows[0].data) : null;
}

export async function claimGuest(guestOwner: string, userOwner: string) {
  const db = await getDatabase();
  await db.query(
    'UPDATE drafts SET owner=$1 WHERE owner=$2 AND NOT EXISTS(SELECT 1 FROM drafts WHERE owner=$1)',
    [userOwner, guestOwner],
  );
}

export async function mutateDraft(
  owner: string,
  input: { actionId: string; expectedRevision: number; command: CommandV2 },
): Promise<DraftV2> {
  return save(
    owner,
    input.actionId,
    input.expectedRevision,
    fingerprint(input),
    (draft, context) => applyCommand(draft, input.command, context!),
    true,
  );
}

export async function saveChat(
  owner: string,
  input: { actionId: string; expectedRevision: number; message: string },
  answer: ChatMessageV2,
): Promise<DraftV2> {
  return save(
    owner,
    input.actionId,
    input.expectedRevision,
    fingerprint({ ...input, kind: 'chat' }),
    (d) => ({
      ...d,
      revision: d.revision + 1,
      updatedAt: new Date().toISOString(),
      messages: [
        ...d.messages,
        {
          id: crypto.randomUUID(),
          role: 'user' as const,
          text: input.message,
          createdAt: new Date().toISOString(),
        },
        answer,
      ].slice(-60),
    }),
    false,
  );
}

export async function replayChat(
  owner: string,
  input: { actionId: string; expectedRevision: number; message: string },
) {
  const db = await getDatabase();
  const rows = await db.query(
    'SELECT a.fingerprint,a.result FROM actions a JOIN drafts d ON d.id=a.draft_id WHERE a.id=$1 AND d.owner=$2',
    [input.actionId, owner],
  );
  if (!rows.length) return null;
  if (rows[0].fingerprint !== fingerprint({ ...input, kind: 'chat' }))
    throw new DomainError('action_conflict', 'This action identifier was already used.', 409);
  return read(rows[0].result);
}

/** Thrown inside the transaction when the locked draft pins a release not loaded yet. */
class ReleasesChanged extends Error {
  constructor(public versions: number[]) {
    super('The draft pins releases that were not loaded.');
  }
}

async function save(
  owner: string,
  actionId: string,
  expected: number,
  hash: string,
  transform: (d: DraftV2, context?: EngineContext) => DraftV2,
  needsCatalog: boolean,
) {
  const db = await getDatabase();
  let context: EngineContext | undefined;
  if (needsCatalog) {
    const [row] = await db.query('SELECT data FROM drafts WHERE owner=$1', [owner]);
    context = await loadEngineContext(row ? pinnedVersions(read(row.data)) : []);
  }
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction(async (query) => {
        const rows = await query('SELECT id,revision,data FROM drafts WHERE owner=$1 FOR UPDATE', [
          owner,
        ]);
        if (!rows.length)
          throw new DomainError(
            'draft_not_found',
            'Your draft could not be found. Reload the studio.',
            404,
          );
        const row = rows[0];
        const prior = await query('SELECT fingerprint,result,draft_id FROM actions WHERE id=$1', [
          actionId,
        ]);
        if (prior.length) {
          if (prior[0].draft_id !== row.id || prior[0].fingerprint !== hash)
            throw new DomainError(
              'action_conflict',
              'This action identifier was already used.',
              409,
            );
          return read(prior[0].result);
        }
        if (row.revision !== expected)
          throw new DomainError(
            'revision_conflict',
            'Your draft changed in another window. We have loaded the latest version; please try your change again.',
            409,
          );
        const before = read(row.data);
        if (context) {
          const missing = pinnedVersions(before).filter((v) => !context!.releases.has(v));
          if (missing.length) throw new ReleasesChanged(missing);
        }
        const after = transform(before, context);
        await query(
          'INSERT INTO revisions(id,draft_id,revision,data) VALUES($1,$2,$3,$4) ON CONFLICT(draft_id,revision) DO NOTHING',
          [crypto.randomUUID(), before.id, before.revision, JSON.stringify(row.data)],
        );
        await query('UPDATE drafts SET revision=$1,data=$2,updated_at=now() WHERE id=$3', [
          after.revision,
          JSON.stringify(after),
          before.id,
        ]);
        await query('INSERT INTO actions(id,draft_id,fingerprint,result) VALUES($1,$2,$3,$4)', [
          actionId,
          before.id,
          hash,
          JSON.stringify(after),
        ]);
        return after;
      });
    } catch (e) {
      if (!(e instanceof ReleasesChanged) || attempt > 0) throw e;
      context = await loadEngineContext([...context!.releases.keys(), ...e.versions]);
    }
  }
}

export async function enforceLimit(key: string, max = 30, seconds = 60) {
  const db = await getDatabase();
  const rows = await db.query(
    "INSERT INTO request_limits(key,count,reset_at) VALUES($1,1,now()+($2 * interval '1 second')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN request_limits.reset_at<now() THEN 1 ELSE request_limits.count+1 END,reset_at=CASE WHEN request_limits.reset_at<now() THEN now()+($2 * interval '1 second') ELSE request_limits.reset_at END RETURNING count",
    [key, seconds],
  );
  if (Number(rows[0].count) > max)
    throw new DomainError(
      'rate_limited',
      'A little too many requests. Please wait a minute and try again.',
      429,
    );
}
