import type { Product } from '../catalog/catalog';
import {
  LEGACY_CLIMATES,
  LEGACY_CLOSURE,
  LEGACY_COLLAR,
  LEGACY_CUFFS,
  LEGACY_JACKET_FIT,
  LEGACY_KEYS,
  LEGACY_LAPEL,
  LEGACY_OCCASIONS,
  LEGACY_POCKETS,
  LEGACY_SHIRT_FIT,
} from '../catalog/legacy-mapping';
import {
  garmentPatch,
  type ChatMessageV2,
  type Design,
  type DesignPatch,
  type DraftV1,
  type DraftV2,
  type Garment,
  type GarmentConfirmation,
  type GarmentPatch,
} from './types';

// Lazy, deterministic v1 → v2 draft upgrade (ADMIN-BACKEND.md §7.2). Pure: it
// maps legacy fields to the codes the importer created (CATALOG-ADMIN §10) and
// never reads a catalog release. A v1 garment pins release 1, the release the
// importer published; if its codes are no longer current, the studio reports
// the catalog update on read (CATALOG-ADMIN §7.8). The upgraded form is
// persisted by the next successful command.

export function isDraftV2(draft: unknown): draft is DraftV2 {
  return (
    !!draft &&
    typeof draft === 'object' &&
    (draft as { schemaVersion?: unknown }).schemaVersion === 2
  );
}

type Selections = Record<string, string>;
const lookup = <T extends Record<string, string>>(table: T, label: string | undefined) =>
  label !== undefined && Object.hasOwn(table, label) ? table[label as keyof T] : undefined;

/** Jacket choices of the legacy detail fields (suit and blazer). */
function jacketDetails(values: Pick<DesignPatch, 'lapel' | 'pockets' | 'closure'>) {
  const selections: Selections = {};
  const lapel = lookup(LEGACY_LAPEL, values.lapel);
  const pockets = lookup(LEGACY_POCKETS, values.pockets);
  const closure = lookup(LEGACY_CLOSURE, values.closure);
  if (lapel) selections[LEGACY_KEYS.lapelType] = lapel;
  if (pockets) selections[LEGACY_KEYS.pocketsType] = pockets;
  if (closure) selections[LEGACY_KEYS.jacketStyle] = closure;
  return selections;
}
function shirtDetails(values: Pick<DesignPatch, 'collar' | 'cuffs'>) {
  const selections: Selections = {};
  const collar = lookup(LEGACY_COLLAR, values.collar);
  const cuffs = lookup(LEGACY_CUFFS, values.cuffs);
  if (collar) selections[LEGACY_KEYS.shirtCollar] = collar;
  if (cuffs) selections[LEGACY_KEYS.shirtCuffs] = cuffs;
  return selections;
}
function fitSelection(product: Product, fit: string | undefined): Selections {
  if (product === 'shirt') {
    const code = lookup(LEGACY_SHIRT_FIT, fit);
    return code ? { [LEGACY_KEYS.shirtFit]: code } : {};
  }
  const code = lookup(LEGACY_JACKET_FIT, fit);
  return code ? { [LEGACY_KEYS.jacketFit]: code } : {};
}

/** The garment of a v1 design (§7.2 rows for product, fabric, parts and choices). */
function garmentFromDesign(id: string, design: Design): Garment {
  let selections: Selections;
  let includedComponents: string[];
  if (design.product === 'suit') {
    const { [LEGACY_KEYS.vest]: vest, ...rest } = design.customizations ?? {};
    selections = { ...rest };
    includedComponents = vest === '1' ? ['jacket', 'trousers', 'vest'] : ['jacket', 'trousers'];
    // A Relaxed fit was never written to the customizations (only Tailored and
    // Classic were), so it takes precedence; otherwise keep the stored fit.
    if (design.fit === 'Relaxed' || selections[LEGACY_KEYS.jacketFit] === undefined)
      Object.assign(selections, fitSelection('suit', design.fit));
  } else if (design.product === 'blazer') {
    includedComponents = ['jacket'];
    selections = { ...fitSelection('blazer', design.fit), ...jacketDetails(design) };
  } else {
    includedComponents = ['shirt'];
    selections = { ...fitSelection('shirt', design.fit), ...shirtDetails(design) };
  }
  const old = new Set(design.confirmed);
  const confirmed: GarmentConfirmation[] = old.has('details')
    ? ['product', 'material', 'preferences', 'details']
    : [
        ...(old.has('product') ? (['product'] as const) : []),
        ...(old.has('fabricId') ? (['material'] as const) : []),
        ...(old.has('occasion') && old.has('climate') ? (['preferences'] as const) : []),
      ];
  return {
    id,
    productCode: design.product,
    templateCode: null,
    catalogVersion: 1,
    materialCode: design.fabricId,
    includedComponents,
    selections,
    preferences: {
      occasion: lookup(LEGACY_OCCASIONS, design.occasion) ?? null,
      climate: lookup(LEGACY_CLIMATES, design.climate) ?? null,
    },
    confirmed,
    quantity: 1,
  };
}

/**
 * A legacy design patch (a v1 chat suggestion) as a garment patch for
 * `product` (the patch's own product, else the garment's). Returns null when
 * nothing in it applies to a garment, so the suggestion is dropped.
 */
export function garmentPatchFromLegacy(patch: DesignPatch, product: Product): GarmentPatch | null {
  const target = patch.product ?? product;
  const next: GarmentPatch = {};
  if (patch.product) next.productCode = patch.product;
  if (patch.fabricId) next.materialCode = patch.fabricId;
  const occasion = lookup(LEGACY_OCCASIONS, patch.occasion);
  const climate = lookup(LEGACY_CLIMATES, patch.climate);
  if (occasion || climate)
    next.preferences = { ...(occasion ? { occasion } : {}), ...(climate ? { climate } : {}) };
  const selections: Selections = { ...fitSelection(target, patch.fit) };
  if (target === 'shirt') Object.assign(selections, shirtDetails(patch));
  else Object.assign(selections, jacketDetails(patch));
  if (target === 'suit' && patch.customizations) {
    const { [LEGACY_KEYS.vest]: vest, ...rest } = patch.customizations;
    Object.assign(selections, rest);
    if (vest !== undefined) next.components = { vest: vest === '1' };
  }
  if (Object.keys(selections).length) next.selections = selections;
  if (!Object.keys(next).length) return null;
  const parsed = garmentPatch.safeParse(next);
  return parsed.success ? parsed.data : null;
}

function upgradeMessage(message: DraftV1['messages'][number], draft: DraftV1): ChatMessageV2 {
  const { suggestion, ...rest } = message;
  if (!suggestion) return rest;
  const patch = garmentPatchFromLegacy(suggestion, draft.design.product);
  return patch ? { ...rest, suggestion: { garmentId: draft.id, patch } } : rest;
}

/** A v2 draft from a v1 or v2 draft; v2 drafts are returned unchanged. */
export function upgradeDraft(input: DraftV1 | DraftV2): DraftV2 {
  if (isDraftV2(input))
    return input.review && !('policyVersion' in input.review) ? { ...input, review: null } : input;
  const garment = garmentFromDesign(input.id, input.design);
  return {
    schemaVersion: 2,
    id: input.id,
    revision: input.revision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    activeGarmentId: garment.id,
    garments: [garment],
    skinTone: input.design.skinTone,
    measurements: input.measurements,
    messages: input.messages.map((message) => upgradeMessage(message, input)),
    review: null,
    orders: [],
  };
}
