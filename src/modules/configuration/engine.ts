import { availableFabrics, fabricFor } from '../catalog/catalog';
import { definitionsFor } from '../measurements/definitions';
import { reviewDraft } from '../review/review';
import { DomainError, type Draft, type Command } from './types';
import {
  defaultSuitCustomizations,
  legacyDesignForSuit,
  suitCustomizationsForLegacyDesign,
  validateSuitCustomizations,
} from '../catalog/suit-customization';
export function createDraft(): Draft {
  const now = new Date().toISOString();
  const customizations = defaultSuitCustomizations();
  const legacyDefaults = legacyDesignForSuit(customizations);
  return {
    id: crypto.randomUUID(),
    revision: 0,
    design: {
      product: 'suit',
      fabricId: 'navy-twill',
      occasion: '',
      climate: '',
      fit: legacyDefaults.fit ?? 'Tailored',
      lapel: legacyDefaults.lapel ?? 'Notch',
      pockets: legacyDefaults.pockets ?? 'Flap',
      closure: legacyDefaults.closure ?? 'Two buttons',
      collar: 'Spread',
      cuffs: 'Button',
      skinTone: 'warm',
      customizations,
      confirmed: [],
    },
    measurements: { version: 0, values: {}, source: 'customer', confirmed: false, updatedAt: null },
    messages: [
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'Welcome to your tailoring studio. What are you looking for — a suit, a shirt, or a blazer?',
        createdAt: now,
        mode: 'guided',
      },
    ],
    review: null,
    createdAt: now,
    updatedAt: now,
  };
}
export function applyCommand(draft: Draft, command: Command): Draft {
  const next = structuredClone(draft);
  next.design.customizations = {
    ...(next.design.product === 'suit' ? defaultSuitCustomizations() : {}),
    ...(next.design.customizations || {}),
  };
  next.revision++;
  next.updatedAt = new Date().toISOString();
  if (command.type === 'design') {
    const p = command.patch;
    const changedProduct = p.product && p.product !== draft.design.product;
    if (changedProduct && draft.design.confirmed.length && !command.confirmCategoryChange)
      throw new DomainError(
        'category_confirmation_required',
        'Changing the garment resets its fabric and finishing choices.',
        409,
      );
    if (changedProduct) {
      next.design = {
        ...createDraft().design,
        product: p.product!,
        fabricId: availableFabrics(p.product!)[0].id,
        occasion: draft.design.occasion,
        climate: draft.design.climate,
        skinTone: draft.design.skinTone,
        customizations: p.product === 'suit' ? defaultSuitCustomizations() : {},
        confirmed: draft.design.confirmed.filter((k) => ['occasion', 'climate'].includes(k)),
      };
      next.measurements.confirmed = false;
    }
    const customizationPatch = {
      ...(next.design.product === 'suit' ? suitCustomizationsForLegacyDesign(p) : {}),
      ...(p.customizations || {}),
    };
    const designPatch = { ...p };
    delete designPatch.customizations;
    Object.assign(next.design, designPatch);
    if (Object.keys(customizationPatch).length) {
      if (next.design.product !== 'suit' || !validateSuitCustomizations(customizationPatch))
        throw new DomainError(
          'invalid_customization',
          'This customization is not available for the selected suit.',
        );
      next.design.customizations = { ...next.design.customizations, ...customizationPatch };
      Object.assign(next.design, legacyDesignForSuit(customizationPatch));
    }
    const f = fabricFor(next.design.fabricId);
    if (!f || !f.products.includes(next.design.product))
      throw new DomainError(
        'incompatible_fabric',
        'This fabric is not available for the selected garment.',
      );
    const confirmationKeys = Object.keys(p).filter((k) =>
      ['product', 'fabricId', 'occasion', 'climate', 'fit'].includes(k),
    );
    next.design.confirmed = Array.from(new Set([...next.design.confirmed, ...confirmationKeys]));
    next.review = null;
  } else if (command.type === 'accept_design') {
    if (!next.design.occasion || !next.design.climate)
      throw new DomainError(
        'design_incomplete',
        'Choose an occasion and weather before confirming.',
      );
    next.design.confirmed = ['product', 'fabricId', 'occasion', 'climate', 'fit', 'details'];
    next.review = null;
  } else if (command.type === 'measurements') {
    const allowed = definitionsFor(next.design.product).map((m) => m.id as string);
    if (Object.keys(command.values).some((k) => !allowed.includes(k)))
      throw new DomainError(
        'unknown_measurement',
        'A measurement field is not valid for this garment.',
      );
    if (command.confirm && allowed.some((k) => !command.values[k]))
      throw new DomainError(
        'missing_measurements',
        'Enter all required measurements before confirming.',
      );
    next.measurements = {
      version: draft.measurements.version + 1,
      values: command.values,
      source: command.source ?? 'customer',
      confirmed: command.confirm,
      updatedAt: next.updatedAt,
    };
    next.review = null;
  } else if (command.type === 'review') {
    next.review = reviewDraft({ ...next, revision: next.revision }, command.mode);
  }
  return next;
}
