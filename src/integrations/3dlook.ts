// 3DLOOK SAIA Mobile Tailor adapter (docs/integrations/3DLOOK.md, INT-001..INT-005).
// This is the public, free widget-capture path: it embeds 3DLOOK's official
// script client-side and only maps/validates the result server-side. There is
// no server-to-server session creation here because the public widget does
// not require one — see scan-service-policy.ts for the separate, still
// unconnected, paid single-use scan path.
export type SaiaPerson = {
  id?: number | string;
  height?: number;
  volume_params?: Record<string, unknown>;
  front_params?: Record<string, unknown>;
  side_params?: Record<string, unknown>;
};

export function normalizeSaiaPublicKey(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) return null;
  return /^[A-Za-z0-9:_-]+$/.test(value) ? value : null;
}

function numeric(record: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

const CM_TO_MM = 10;

// Maps 3DLOOK's SAIA person payload onto Vessy's own measurement field IDs
// (src/modules/measurements/definitions.ts), converting centimeters to the
// millimeters used internally. Only fields Vessy actually asks for are
// mapped; everything else stays in extractRawSaiaDimensions as source
// evidence only (INT-004: never invent a garment field from unmapped data).
export function mapSaiaPersonToMillimeters(person: SaiaPerson): Record<string, number> {
  const volume = person.volume_params;
  const front = person.front_params;
  const side = person.side_params;
  const cm: Record<string, number | undefined> = {
    height: typeof person.height === 'number' && Number.isFinite(person.height) && person.height > 0
      ? person.height
      : undefined,
    neck: numeric(volume, 'neck_girth', 'neck'),
    chest: numeric(volume, 'chest_girth', 'chest'),
    waist: numeric(volume, 'waist_girth', 'waist'),
    shoulder: numeric(front, 'shoulders', 'across_back_shoulder_width'),
    sleeve: numeric(front, 'sleeve_length'),
    hips: numeric(volume, 'low_hips_girth', 'low_hips', 'hips'),
    inseam: numeric(front, 'inseam') ?? numeric(side, 'inseam'),
    // Additional-accuracy fields (definitions.ts `advanced`): mapped when
    // present, never required to confirm measurements.
    bicep: numeric(volume, 'bicep_girth', 'bicep'),
    forearm: numeric(volume, 'forearm_girth', 'forearm'),
    wrist: numeric(volume, 'wrist_girth', 'wrist'),
    thigh: numeric(volume, 'thigh_girth', 'thigh'),
    knee: numeric(volume, 'knee_girth', 'knee'),
    calf: numeric(volume, 'calf_girth', 'calf'),
    ankle: numeric(volume, 'ankle_girth', 'ankle'),
    jacketLength: numeric(front, 'jacket_length'),
    frontRise: numeric(front, 'front_crotch_length'),
    backRise: numeric(front, 'back_crotch_length'),
  };
  return Object.fromEntries(
    Object.entries(cm)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      .map(([id, value]) => [id, Math.round(value * CM_TO_MM * 100) / 100]),
  );
}

export function extractRawSaiaDimensions(person: SaiaPerson) {
  const dims: { section: string; label: string; value: number }[] = [];
  const addParams = (section: string, params: Record<string, unknown> | undefined) => {
    if (!params) return;
    for (const [label, value] of Object.entries(params))
      if (typeof value === 'number' && Number.isFinite(value)) dims.push({ section, label, value });
  };
  addParams('volume', person.volume_params);
  addParams('front', person.front_params);
  addParams('side', person.side_params);
  if (typeof person.height === 'number' && Number.isFinite(person.height))
    dims.push({ section: 'body', label: 'height', value: person.height });
  return dims;
}

export function isTrustedSaiaMessage(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  iframeWindow: Window | null | undefined,
) {
  if (event.origin !== 'https://mtm-widget.3dlook.me' || !iframeWindow || event.source !== iframeWindow)
    return false;
  if (!event.data || typeof event.data !== 'object') return false;
  return (event.data as { command?: unknown }).command === 'saia-pf-widget.data';
}
