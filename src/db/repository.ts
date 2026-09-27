import { createHash } from 'node:crypto';
import { getDatabase } from './client';
import { createDraft, applyCommand } from '@/modules/configuration/engine';
import {
  DomainError,
  type Draft,
  type Command,
  type ChatMessage,
} from '@/modules/configuration/types';
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function getDraft(owner: string): Promise<Draft> {
  const db = await getDatabase();
  const draft = createDraft();
  await db.query(
    'INSERT INTO drafts(id,owner,revision,data) VALUES($1,$2,0,$3) ON CONFLICT(owner) DO NOTHING',
    [draft.id, owner, JSON.stringify(draft)],
  );
  const rows = await db.query('SELECT data FROM drafts WHERE owner=$1', [owner]);
  return rows[0].data as Draft;
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
  input: { actionId: string; expectedRevision: number; command: Command },
): Promise<Draft> {
  return save(owner, input.actionId, input.expectedRevision, fingerprint(input), (d) =>
    applyCommand(d, input.command),
  );
}
export async function saveChat(
  owner: string,
  input: { actionId: string; expectedRevision: number; message: string },
  answer: ChatMessage,
): Promise<Draft> {
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
  return rows[0].result as Draft;
}
async function save(
  owner: string,
  actionId: string,
  expected: number,
  hash: string,
  transform: (d: Draft) => Draft,
) {
  const db = await getDatabase();
  return db.transaction(async (query) => {
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
        throw new DomainError('action_conflict', 'This action identifier was already used.', 409);
      return prior[0].result as Draft;
    }
    if (row.revision !== expected)
      throw new DomainError(
        'revision_conflict',
        'Your draft changed in another window. We have loaded the latest version; please try your change again.',
        409,
      );
    const before = row.data as Draft;
    const after = transform(before);
    await query(
      'INSERT INTO revisions(id,draft_id,revision,data) VALUES($1,$2,$3,$4) ON CONFLICT(draft_id,revision) DO NOTHING',
      [crypto.randomUUID(), before.id, before.revision, JSON.stringify(before)],
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
