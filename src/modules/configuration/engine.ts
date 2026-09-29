import {
  applyGarmentPatch,
  hasConfirmedChoices,
  newGarment,
  rebaseGarment,
  validateGarment,
  type AvailabilityMap,
  type GarmentIssue,
} from '../catalog/garment';
import type { RuntimeIndex } from '../catalog/snapshot';
import {
  definitionsForProducts,
  requiredDefinitionsForProducts,
  type MeasurementSet,
} from '../measurements/definitions';
import {
  DomainError,
  MAX_GARMENTS,
  type CommandV2,
  type DraftV2,
  type Garment,
  type Impact,
} from './types';

// The draft engine, v2 (ADMIN-BACKEND.md §7.1). Pure: the repository supplies
// the catalog releases and live availability. A draft holds 0–10 garments;
// commands without a garmentId target the active garment. Every command that
// changes a garment first moves it to the current release when that loses
// nothing, and otherwise asks the customer to review the catalog update.

export type EngineContext = {
  /** The current release. New garments and rebases use it. */
  current: RuntimeIndex;
  /** Releases garments are pinned to, by version; includes the current one. */
  releases: ReadonlyMap<number, RuntimeIndex>;
  availability?: AvailabilityMap;
  newId?: () => string;
  now?: () => string;
};

export const WELCOME_MESSAGE =
  'Welcome to your tailoring studio. What are you looking for — a suit, a shirt, or a blazer?';

export function createDraft(now = new Date().toISOString(), id = crypto.randomUUID()): DraftV2 {
  return {
    schemaVersion: 2,
    id,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    activeGarmentId: null,
    garments: [],
    skinTone: 'warm',
    measurements: { version: 0, values: {}, source: 'customer', confirmed: false, updatedAt: null },
    messages: [
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: WELCOME_MESSAGE,
        createdAt: now,
        mode: 'guided',
      },
    ],
    review: null,
    orders: [],
  };
}

/** The release a garment is pinned to, when loaded. */
export function releaseOf(context: EngineContext, garment: Garment) {
  if (garment.catalogVersion === context.current.catalog.version) return context.current;
  return context.releases.get(garment.catalogVersion);
}

/** Versions the engine needs for a draft: the pinned release of every garment. */
export function pinnedVersions(draft: DraftV2) {
  return [...new Set(draft.garments.map((garment) => garment.catalogVersion))];
}

/** The measurement sets of the cart's garments, in cart order (CRT-004). */
export function measurementSets(context: EngineContext, draft: DraftV2): MeasurementSet[] {
  const sets = new Set<MeasurementSet>();
  for (const garment of draft.garments) {
    const product = releaseOf(context, garment)?.products.get(garment.productCode);
    if (product) sets.add(product.measurementSet);
  }
  return [...sets];
}

/**
 * The catalog update a stale garment needs (CATALOG-ADMIN §7.8): null when it
 * is on the current release; otherwise the rebased garment and its impact.
 */
export function catalogUpdate(context: EngineContext, garment: Garment) {
  if (garment.catalogVersion === context.current.catalog.version) return null;
  const from = context.releases.get(garment.catalogVersion);
  if (!from)
    throw new DomainError(
      'catalog_unavailable',
      'Your garment’s catalog could not be loaded. Please try again.',
      503,
    );
  return rebaseGarment(from, context.current, garment);
}

/** The garment on the current release, rebased silently when that loses nothing. */
function onCurrentRelease(context: EngineContext, garment: Garment) {
  const update = catalogUpdate(context, garment);
  if (!update) return garment;
  if (update.impact.length)
    throw new DomainError(
      'catalog_update_required',
      'Our catalog changed. Please review the changes to this garment first.',
      409,
      { garmentId: garment.id, impact: update.impact },
    );
  return update.garment;
}

function garmentIndex(draft: DraftV2, garmentId?: string) {
  const id = garmentId ?? draft.activeGarmentId;
  if (!id) throw new DomainError('garment_not_found', 'Choose a garment first.', 422);
  const index = draft.garments.findIndex((garment) => garment.id === id);
  if (index < 0)
    throw new DomainError('garment_not_found', 'That garment is no longer in your cart.', 404);
  return index;
}

function requiredIds(context: EngineContext, draft: DraftV2) {
  return requiredDefinitionsForProducts(measurementSets(context, draft)).map((m) => m.id as string);
}

/** Why a garment cannot be accepted, in customer language (422 design_incomplete). */
function incompleteMessage(index: RuntimeIndex, issues: GarmentIssue[]) {
  if (issues.some((issue) => issue.kind === 'preference_missing'))
    return 'Choose an occasion and weather before confirming.';
  const names = issues.flatMap((issue) =>
    'attributeCode' in issue
      ? [index.attributes.get(issue.attributeCode)?.attribute.name ?? issue.attributeCode]
      : issue.kind === 'material_invalid'
        ? ['Fabric']
        : [],
  );
  return names.length
    ? `Complete these choices before confirming: ${[...new Set(names)].join(', ')}.`
    : 'This garment is no longer available. Please choose another.';
}
const missingCode = (issue: GarmentIssue) =>
  issue.kind === 'preference_missing'
    ? issue.code
    : issue.kind === 'material_invalid'
      ? 'material'
      : issue.kind === 'product_unavailable'
        ? 'product'
        : issue.attributeCode;

export function applyCommand(draft: DraftV2, command: CommandV2, context: EngineContext): DraftV2 {
  const next = structuredClone(draft);
  const now = context.now?.() ?? new Date().toISOString();
  next.revision++;
  next.updatedAt = now;
  const setGarment = (index: number, garment: Garment) => {
    next.garments[index] = garment;
  };
  switch (command.type) {
    case 'add_garment': {
      if (next.garments.length >= MAX_GARMENTS)
        throw new DomainError(
          'garment_limit_reached',
          `A cart can hold up to ${MAX_GARMENTS} garments.`,
          422,
        );
      const before = new Set(requiredIds(context, next));
      const garment = newGarment(
        context.current,
        command.productCode,
        context.newId?.() ?? crypto.randomUUID(),
        command.templateCode ?? null,
      );
      next.garments.push(garment);
      next.activeGarmentId = garment.id;
      // CRT-004: a garment needing fields the profile lacks unconfirms it.
      const added = requiredIds(context, next).filter((id) => !before.has(id));
      if (added.some((id) => !next.measurements.values[id])) next.measurements.confirmed = false;
      next.review = null;
      break;
    }
    case 'remove_garment': {
      const index = garmentIndex(next, command.garmentId);
      if (hasConfirmedChoices(next.garments[index]) && !command.confirm)
        throw new DomainError(
          'garment_removal_confirmation_required',
          'This garment has choices you confirmed. Remove it anyway?',
          409,
          { garmentId: command.garmentId },
        );
      next.garments.splice(index, 1);
      if (next.activeGarmentId === command.garmentId)
        next.activeGarmentId = next.garments.at(-1)?.id ?? null;
      next.review = null;
      break;
    }
    case 'select_garment':
      next.activeGarmentId = next.garments[garmentIndex(next, command.garmentId)].id;
      break;
    case 'design': {
      const index = garmentIndex(next, command.garmentId);
      const garment = onCurrentRelease(context, next.garments[index]);
      const result = applyGarmentPatch(context.current, garment, command.patch, {
        confirmImpact: command.confirmImpact,
        confirmCategoryChange: command.confirmCategoryChange,
        availability: context.availability,
      });
      if (result.garment.productCode !== garment.productCode) next.measurements.confirmed = false;
      setGarment(index, result.garment);
      next.review = null;
      break;
    }
    case 'set_quantity': {
      const index = garmentIndex(next, command.garmentId);
      setGarment(index, {
        ...onCurrentRelease(context, next.garments[index]),
        quantity: command.quantity,
      });
      next.review = null;
      break;
    }
    case 'accept_design': {
      const index = garmentIndex(next, command.garmentId);
      const garment = onCurrentRelease(context, next.garments[index]);
      const { issues } = validateGarment(context.current, garment);
      if (issues.length)
        throw new DomainError(
          'design_incomplete',
          incompleteMessage(context.current, issues),
          422,
          { garmentId: garment.id, missing: [...new Set(issues.map(missingCode))] },
        );
      setGarment(index, {
        ...garment,
        confirmed: ['product', 'material', 'preferences', 'details'],
      });
      next.review = null;
      break;
    }
    case 'rebase_catalog': {
      const index = garmentIndex(next, command.garmentId);
      const update = catalogUpdate(context, next.garments[index]);
      if (!update) break;
      if (update.impact.some((item) => item.kind === 'product_unavailable'))
        throw new DomainError(
          'product_unavailable',
          'This garment is no longer offered. Remove it or choose another garment.',
          422,
          { garmentId: command.garmentId, impact: update.impact },
        );
      if (update.impact.length && !command.confirmImpact)
        throw new DomainError(
          'impact_confirmation_required',
          'Our catalog changed. Please review the changes to this garment.',
          409,
          { impact: update.impact },
        );
      setGarment(index, update.garment);
      next.review = null;
      break;
    }
    case 'appearance':
      next.skinTone = command.skinTone;
      break;
    case 'measurements': {
      const sets = measurementSets(context, next);
      if (!sets.length)
        throw new DomainError('cart_empty', 'Choose a garment before adding measurements.', 422);
      const allowed = definitionsForProducts(sets).map((m) => m.id as string);
      const required = requiredDefinitionsForProducts(sets).map((m) => m.id as string);
      if (Object.keys(command.values).some((key) => !allowed.includes(key)))
        throw new DomainError(
          'unknown_measurement',
          'A measurement field is not valid for this garment.',
        );
      if (command.confirm && required.some((key) => !command.values[key]))
        throw new DomainError(
          'missing_measurements',
          'Enter all required measurements before confirming.',
        );
      next.measurements = {
        version: draft.measurements.version + 1,
        values: command.values,
        source: command.source ?? 'customer',
        confirmed: command.confirm,
        updatedAt: now,
      };
      next.review = null;
      break;
    }
  }
  next.review = null;
  return next;
}

/** Catalog updates to show on read: garments whose rebase would change a choice (§7.8). */
export function catalogUpdates(
  context: EngineContext,
  draft: DraftV2,
): { garmentId: string; impact: Impact[] }[] {
  return draft.garments.flatMap((garment) => {
    const update = catalogUpdate(context, garment);
    return update?.impact.length ? [{ garmentId: garment.id, impact: update.impact }] : [];
  });
}
