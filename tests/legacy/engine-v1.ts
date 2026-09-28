import { availableFabrics, fabricFor } from '../../src/modules/catalog/catalog';
import {
  defaultSuitCustomizations,
  legacyDesignForSuit,
  suitCustomizationsForLegacyDesign,
  validateSuitCustomizations,
} from '../../src/modules/catalog/suit-customization';
import { DomainError, type Command, type Draft } from '../../src/modules/configuration/types';

// The pre-D-019 (v1) design engine, kept for tests only: it builds the v1
// designs that the WP-00b renderer goldens and the not-yet-ported outline and
// 3D garment tests were recorded from. Production code uses the v2 engine in
// src/modules/configuration/engine.ts. Removed once WP-14 and WP-15 port those
// tests to v2 garments. Design commands only; SYNTHETIC drafts only.

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
    messages: [],
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
  if (command.type === 'accept_design') {
    next.design.confirmed = ['product', 'fabricId', 'occasion', 'climate', 'fit', 'details'];
    return next;
  }
  if (command.type !== 'design')
    throw new Error(`The v1 test engine only designs (${command.type}).`);
  const p = command.patch;
  const changedProduct = p.product && p.product !== draft.design.product;
  if (changedProduct && draft.design.confirmed.length && !command.confirmCategoryChange)
    throw new DomainError('category_confirmation_required', 'Changing the garment resets it.', 409);
  if (changedProduct)
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
  const customizationPatch = {
    ...(next.design.product === 'suit' ? suitCustomizationsForLegacyDesign(p) : {}),
    ...(p.customizations || {}),
  };
  const designPatch = { ...p };
  delete designPatch.customizations;
  Object.assign(next.design, designPatch);
  if (Object.keys(customizationPatch).length) {
    if (next.design.product !== 'suit' || !validateSuitCustomizations(customizationPatch))
      throw new DomainError('invalid_customization', 'This customization is not available.');
    next.design.customizations = { ...next.design.customizations, ...customizationPatch };
    Object.assign(next.design, legacyDesignForSuit(customizationPatch));
  }
  const f = fabricFor(next.design.fabricId);
  if (!f || !f.products.includes(next.design.product))
    throw new DomainError('incompatible_fabric', 'This fabric is not available.');
  const confirmationKeys = Object.keys(p).filter((k) =>
    ['product', 'fabricId', 'occasion', 'climate', 'fit'].includes(k),
  );
  next.design.confirmed = Array.from(new Set([...next.design.confirmed, ...confirmationKeys]));
  return next;
}
