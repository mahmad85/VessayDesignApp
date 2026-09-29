import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MEASUREMENTS } from '@/modules/measurements/definitions';
const FIELDS = new Set(MEASUREMENTS.map((m) => m.id as string));
// Girth/length fields tolerate a wide range because they cover every garment
// this studio offers; height gets a tighter human-plausible band.
const RANGE: Record<string, [number, number]> = { height: [1200, 2300] };
const DEFAULT_RANGE: [number, number] = [40, 2000];
export function normalizeSaiaDraftMeasurements(raw: Record<string, unknown>) {
  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!FIELDS.has(key)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
      throw new Error('invalid_measurements');
    const [min, max] = RANGE[key] ?? DEFAULT_RANGE;
    if (value < min || value > max) throw new Error('invalid_measurements');
    values[key] = Math.round(value * 100) / 100;
  }
  if (Object.keys(values).length === 0) throw new Error('no_supported_measurements');
  return values;
}
export function assertSaiaDraftOwner(actualOwnerId: string, requestOwnerId: string) {
  if (actualOwnerId !== requestOwnerId) throw new Error('draft_not_found');
}
export function sanitizeProviderPersonId(value: unknown) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !String(value).trim())
    throw new Error('invalid_provider_person');
  const result = String(value).trim();
  if (result.length > 150) throw new Error('invalid_provider_person');
  return result;
}
// The raw provider person ID never reaches the database; only a keyed
// fingerprint of it is stored, so a leaked draft row cannot be replayed
// against the vendor.
export function fingerprintSaiaProviderResult(
  ownerId: string,
  providerPersonId: string,
  secret: string,
) {
  if (!secret) throw new Error('capture_not_configured');
  return createHmac('sha256', secret).update(`${ownerId}\0${providerPersonId}`).digest('base64url');
}
// Keyed like auth.ts's authSecret(): a stable per-environment secret for
// fingerprinting provider person IDs. Production must configure it
// explicitly; development persists a generated one to .data so drafts
// survive restarts.
export async function saiaFingerprintSecret() {
  if (process.env.SAIA_DRAFT_FINGERPRINT_SECRET) return process.env.SAIA_DRAFT_FINGERPRINT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('capture_not_configured');
  const file = path.join(process.cwd(), '.data/saia-fingerprint-secret');
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    return await readFile(file, 'utf8');
  } catch {
    const value = randomBytes(48).toString('base64url');
    try {
      await writeFile(file, value, { flag: 'wx', mode: 0o600 });
      return value;
    } catch {
      return readFile(file, 'utf8');
    }
  }
}
export function shouldReuseSaiaDraft(
  draft: { status: string; measurements: Record<string, number> | null } | undefined,
) {
  return draft?.status === 'saved' && Boolean(draft.measurements);
}
