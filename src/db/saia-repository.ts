import { randomBytes } from 'node:crypto';
import { getDatabase } from './client';
import { DomainError } from '@/modules/configuration/types';
export type SaiaDraftRow = {
  id: number;
  owner_id: string;
  entitlement_id: number | null;
  capture_token: string;
  provider_person_id: string | null;
  status: string;
  target_unit: string;
  measurements: Record<string, number> | null;
  source_dimensions: Array<{ section: string; label: string; value: number }> | null;
  error_code: string | null;
  created_at: Date;
  updated_at: Date;
};
function mapDraft(row: SaiaDraftRow) {
  return {
    id: row.id,
    captureToken: row.capture_token,
    profileId: null,
    status: row.status,
    targetUnit: row.target_unit,
    measurements: row.measurements,
    sourceDimensions: row.source_dimensions,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export async function getLatestSaiaDraft(ownerId: string) {
  const db = await getDatabase();
  const rows = await db.query<SaiaDraftRow>(
    'SELECT * FROM saia_measurement_drafts WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 1',
    [ownerId],
  );
  return rows[0] ? mapDraft(rows[0]) : null;
}
export async function createPublicSaiaSession(ownerId: string, targetUnit: 'cm' | 'in') {
  const db = await getDatabase();
  return db.transaction(async (query) => {
    const resumable = await query<SaiaDraftRow>(
      'SELECT * FROM saia_measurement_drafts WHERE owner_id=$1 AND entitlement_id IS NULL ORDER BY updated_at DESC LIMIT 1',
      [ownerId],
    );
    if (resumable[0] && resumable[0].status !== 'saved') {
      const updated = await query<SaiaDraftRow>(
        'UPDATE saia_measurement_drafts SET target_unit=$1,status=$2,error_code=NULL,updated_at=now() WHERE id=$3 RETURNING *',
        [targetUnit, 'pending', resumable[0].id],
      );
      return mapDraft(updated[0]);
    }
    const created = await query<SaiaDraftRow>(
      'INSERT INTO saia_measurement_drafts(owner_id,capture_token,target_unit,status) VALUES($1,$2,$3,$4) RETURNING *',
      [ownerId, randomBytes(24).toString('base64url'), targetUnit, 'pending'],
    );
    return mapDraft(created[0]);
  });
}
// The paid path stays unreachable until 3DLOOK supplies a private
// single-use scan-authorization capability (scan-service-policy.ts). This
// mirrors that dead-but-correct branch: there is no way to reach here with
// an authorized entitlement today, but the shape is kept so activating the
// vendor capability later does not require touching this flow again.
export async function createPaidSaiaSession(ownerId: string, targetUnit: 'cm' | 'in') {
  const db = await getDatabase();
  const result = await db.transaction(async (query) => {
    const resumeEntitlement = await query<{ id: number }>(
      "SELECT id FROM scan_entitlements WHERE owner_id=$1 AND status='consumed' ORDER BY updated_at DESC LIMIT 1",
      [ownerId],
    );
    if (resumeEntitlement[0]) {
      const existing = await query<SaiaDraftRow>(
        'SELECT * FROM saia_measurement_drafts WHERE owner_id=$1 AND entitlement_id=$2 ORDER BY updated_at DESC LIMIT 1',
        [ownerId, resumeEntitlement[0].id],
      );
      if (existing[0] && existing[0].status !== 'saved') return existing[0];
    }
    const candidate = await query<{ id: number }>(
      "SELECT id FROM scan_entitlements WHERE owner_id=$1 AND status='authorized' ORDER BY created_at LIMIT 1",
      [ownerId],
    );
    if (!candidate[0]) return null;
    const consumed = await query<{ id: number }>(
      "UPDATE scan_entitlements SET status='consumed',consumed_at=now(),updated_at=now() WHERE id=$1 AND status='authorized' RETURNING id",
      [candidate[0].id],
    );
    if (!consumed[0]) return null;
    const created = await query<SaiaDraftRow>(
      'INSERT INTO saia_measurement_drafts(owner_id,entitlement_id,capture_token,target_unit,status) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [ownerId, consumed[0].id, randomBytes(24).toString('base64url'), targetUnit, 'pending'],
    );
    await query(
      'INSERT INTO scan_attempt_events(entitlement_id,owner_id,event_type,actor_id,metadata) VALUES($1,$2,$3,$4,$5)',
      [consumed[0].id, ownerId, 'entitlement_consumed', ownerId, JSON.stringify({ draftId: created[0].id })],
    );
    return created[0];
  });
  if (!result) throw new DomainError('no_paid_scan_available', 'No paid AI scan is available for this account.', 403);
  return mapDraft(result);
}
export async function saveSaiaDraftResult(
  ownerId: string,
  captureToken: string,
  input: {
    providerResultFingerprint: string;
    measurements: Record<string, number>;
    sourceDimensions: Array<{ section: string; label: string; value: number }>;
  },
) {
  const db = await getDatabase();
  return db.transaction(async (query) => {
    const rows = await query<SaiaDraftRow>('SELECT * FROM saia_measurement_drafts WHERE capture_token=$1', [
      captureToken,
    ]);
    const session = rows[0];
    if (!session || session.owner_id !== ownerId) throw new Error('draft_not_found');
    const existingPersonDraft = await query<SaiaDraftRow>(
      'SELECT * FROM saia_measurement_drafts WHERE owner_id=$1 AND provider_person_id=$2 ORDER BY updated_at DESC LIMIT 1',
      [ownerId, input.providerResultFingerprint],
    );
    if (existingPersonDraft[0]?.status === 'saved' && existingPersonDraft[0].measurements) {
      const refreshed = await query<SaiaDraftRow>(
        'UPDATE saia_measurement_drafts SET updated_at=now() WHERE id=$1 RETURNING *',
        [existingPersonDraft[0].id],
      );
      return mapDraft(refreshed[0]);
    }
    await query(
      'INSERT INTO measurement_source_snapshots(owner_id,source,source_metadata,raw_dimensions,canonical_dimensions) VALUES($1,$2,$3,$4,$5)',
      [
        ownerId,
        'saia',
        JSON.stringify({ provider: '3dlook-saia-mtm', providerPersonFingerprint: input.providerResultFingerprint, targetUnit: session.target_unit }),
        JSON.stringify(input.sourceDimensions),
        JSON.stringify(input.measurements),
      ],
    );
    const saved = await query<SaiaDraftRow>(
      'UPDATE saia_measurement_drafts SET provider_person_id=$1,measurements=$2,source_dimensions=$3,status=$4,error_code=NULL,updated_at=now() WHERE capture_token=$5 AND owner_id=$6 RETURNING *',
      [input.providerResultFingerprint, JSON.stringify(input.measurements), JSON.stringify(input.sourceDimensions), 'saved', captureToken, ownerId],
    );
    if (saved[0].entitlement_id) {
      await query(
        "UPDATE scan_entitlements SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1 AND owner_id=$2",
        [saved[0].entitlement_id, ownerId],
      );
      await query(
        'INSERT INTO scan_attempt_events(entitlement_id,owner_id,event_type,actor_id,metadata) VALUES($1,$2,$3,$4,$5)',
        [saved[0].entitlement_id, ownerId, 'result_saved', ownerId, JSON.stringify({ draftId: saved[0].id })],
      );
    }
    return mapDraft(saved[0]);
  });
}
export async function markSaiaDraftFailed(ownerId: string, captureToken: string, errorCode: string) {
  const db = await getDatabase();
  await db.query(
    'UPDATE saia_measurement_drafts SET status=$1,error_code=$2,updated_at=now() WHERE capture_token=$3 AND owner_id=$4',
    ['failed', errorCode, captureToken, ownerId],
  );
}
