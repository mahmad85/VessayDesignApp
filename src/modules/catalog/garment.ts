import {
  DomainError,
  type Garment,
  type GarmentConfirmation,
  type GarmentPatch,
  type Impact,
} from '../configuration/types';
import {
  valueKey,
  type RuntimeAttribute,
  type RuntimeIndex,
  type RuntimeProduct,
} from './snapshot';
import {
  attributeAvailable,
  defaultGarment,
  defaultsFor,
  effectiveSelections,
  groupAvailable,
  productDefault,
  ruleViolations,
  valueAvailable,
  type Effective,
  type GarmentShape,
} from './structure';

// One garment configuration against one catalog release (CATALOG-ADMIN.md §5.3,
// §7.8; ADMIN-BACKEND.md §7.1). Every command path — the direct controls, chat
// suggestions, looks and rebase — changes a garment only through
// applyGarmentPatch, so they share the same validation (CAT-010). The engine
// never silently changes an accepted choice: rule-driven changes to other
// options come back as an impact list the customer must accept.

/** Live fabric availability (CATALOG-ADMIN §7.6); not part of the release. */
export type MaterialAvailability =
  'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued' | 'unknown';
export type AvailabilityMap = Readonly<Record<string, MaterialAvailability>>;

export function isSelectable(availability: MaterialAvailability | undefined) {
  return availability !== 'out_of_stock' && availability !== 'discontinued';
}

/** Usages that make a fabric selectable as the garment's own cloth in this scope. */
const GARMENT_USAGES = new Set(['shell', 'shirting']);

export function materialAllowed(index: RuntimeIndex, productCode: string, materialCode: string) {
  const material = index.materials.get(materialCode);
  return (
    !!material &&
    material.productCodes.includes(productCode) &&
    material.usages.some((usage) => GARMENT_USAGES.has(usage))
  );
}

/** Fabrics a product offers: its default fabric first, then catalog order. */
export function materialsFor(index: RuntimeIndex, productCode: string) {
  const first = index.products.get(productCode)?.defaultMaterialCode;
  return index.catalog.materials
    .filter((material) => materialAllowed(index, productCode, material.code))
    .sort((a, b) => Number(b.code === first) - Number(a.code === first));
}

export function valueLabel(index: RuntimeIndex, attributeCode: string, value: string) {
  const entry = index.values.get(valueKey(attributeCode, value));
  return entry ? entry.value.label : value;
}

const shape = (garment: Garment): GarmentShape => garment;

export type ApplyOptions = {
  confirmImpact?: boolean;
  confirmCategoryChange?: boolean;
  availability?: AvailabilityMap;
};
export type ApplyResult = { garment: Garment; impact: Impact[] };

/** A new garment with the product defaults (or a look's resolved configuration). */
export function newGarment(
  index: RuntimeIndex,
  productCode: string,
  id: string,
  templateCode: string | null = null,
): Garment {
  const product = index.products.get(productCode);
  if (!product)
    throw new DomainError(
      'product_unavailable',
      'This garment is not available in the current catalog.',
      422,
    );
  const base = defaultGarment(index, product);
  const template = templateCode ? index.templates.get(templateCode) : undefined;
  if (templateCode && (!template || template.productCode !== productCode))
    throw new DomainError('template_unavailable', 'This look is no longer available.', 422);
  return {
    id,
    productCode,
    templateCode: template ? template.code : null,
    catalogVersion: index.catalog.version,
    materialCode: template?.materialCode ?? base.materialCode,
    includedComponents: template
      ? product.components
          .filter(
            (link) => link.required || template.includedComponents.includes(link.componentCode),
          )
          .map((link) => link.componentCode)
      : [...base.includedComponents],
    selections: { ...base.selections, ...(template?.selections ?? {}) },
    preferences: {
      occasion: template?.occasions[0] ?? null,
      climate: template?.climates[0] ?? null,
    },
    confirmed: ['product'],
    quantity: 1,
  };
}

function checkText(attribute: RuntimeAttribute, raw: string) {
  const rules = attribute.textRules;
  const text = rules?.transform === 'upper' ? raw.trim().toUpperCase() : raw.trim();
  const invalid = () =>
    new DomainError(
      'invalid_text',
      rules
        ? `${attribute.name} accepts up to ${rules.maxLength} characters${rules.pattern ? ' of the allowed kind' : ''}.`
        : `${attribute.name} cannot be personalised.`,
      422,
      { attributeCode: attribute.code },
    );
  if (!rules || text.length > rules.maxLength) throw invalid();
  if (rules.pattern) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(rules.pattern);
    } catch {
      throw invalid();
    }
    if (!pattern.test(text)) throw invalid();
  }
  return text;
}

function unavailable(attributeCode: string, valueCode: string, message?: string) {
  return new DomainError(
    'unavailable_option',
    message ?? 'This choice is not available for the selected garment.',
    422,
    { attributeCode, valueCode },
  );
}

/** Choice codes are checked against the release and the product settings; text against its rules. */
function checkSelection(
  index: RuntimeIndex,
  product: RuntimeProduct,
  code: string,
  value: string,
): string | null {
  const entry = index.attributes.get(code);
  const linked =
    entry && product.components.some((link) => link.componentCode === entry.component.code);
  if (
    !entry ||
    !linked ||
    !groupAvailable(product, entry.group.code) ||
    !attributeAvailable(product, code)
  )
    throw unavailable(code, value);
  if (entry.attribute.inputType === 'text') {
    if (value.trim() === '') return null;
    return checkText(entry.attribute, value);
  }
  if (!index.values.has(valueKey(code, value)) || !valueAvailable(product, code, value))
    throw unavailable(code, value);
  return value;
}

function checkPreference(index: RuntimeIndex, type: 'occasion' | 'climate', code: string | null) {
  if (code !== null && !index.lookups.get(type)?.has(code))
    throw new DomainError(
      'unavailable_option',
      `This ${type === 'occasion' ? 'occasion' : 'weather'} is not available.`,
      422,
      { attributeCode: type, valueCode: code },
    );
}

/** A choice for `attribute` that satisfies every rule, preferring the product default, else null. */
function resolveViolation(
  index: RuntimeIndex,
  product: RuntimeProduct,
  garment: Garment,
  attribute: RuntimeAttribute,
) {
  const fallback = productDefault(product, attribute);
  const offered = attribute.values
    .filter((value) => valueAvailable(product, attribute.code, value.code))
    .map((value) => value.code);
  const candidates = [...(fallback && offered.includes(fallback) ? [fallback] : []), ...offered];
  for (const candidate of candidates) {
    const trial = {
      ...garment,
      selections: { ...garment.selections, [attribute.code]: candidate },
    };
    const clear = !ruleViolations(index, effectiveSelections(index, shape(trial))).some(
      (violation) => violation.attributeCode === attribute.code,
    );
    if (clear) return candidate;
  }
  return null;
}

const MAX_RESOLUTION_PASSES = 5;

/**
 * Resolve rule violations on options the customer did not change in this patch,
 * as an impact list; a violation on an option they did change is an error.
 */
function resolveRules(
  index: RuntimeIndex,
  product: RuntimeProduct,
  garment: Garment,
  changed: ReadonlySet<string>,
) {
  const impact = new Map<string, Impact>();
  let next = garment;
  for (let pass = 0; pass < MAX_RESOLUTION_PASSES; pass++) {
    const violations = ruleViolations(index, effectiveSelections(index, shape(next)));
    if (!violations.length) return { garment: next, impact: [...impact.values()] };
    for (const violation of violations) {
      const current = next.selections[violation.attributeCode];
      if (changed.has(violation.attributeCode))
        throw unavailable(violation.attributeCode, current ?? '', violation.message);
      const attribute = index.attributes.get(violation.attributeCode)!.attribute;
      const to = resolveViolation(index, product, next, attribute);
      const selections = { ...next.selections };
      if (to === null) delete selections[attribute.code];
      else selections[attribute.code] = to;
      next = { ...next, selections };
      // One entry per option, from the customer's choice to the final resolution.
      const from = impact.get(attribute.code)?.from ?? current;
      const fromLabel = from === undefined ? 'no choice' : valueLabel(index, attribute.code, from);
      impact.set(attribute.code, {
        garmentId: garment.id,
        kind: to === null ? 'selection_removed' : 'selection_replaced',
        attributeCode: attribute.code,
        ...(from === undefined ? {} : { from }),
        ...(to === null ? {} : { to }),
        message:
          to === null
            ? `${attribute.name}: ${fromLabel} is removed. ${violation.message}`
            : `${attribute.name} changes from ${fromLabel} to ${valueLabel(index, attribute.code, to)}. ${violation.message}`,
      });
    }
  }
  throw new DomainError(
    'unavailable_option',
    'This combination of choices is not available. Please try a different choice.',
    422,
  );
}

/** Removing a garment with choices beyond its product needs confirmation (CRT-003). */
export function hasConfirmedChoices(garment: Garment) {
  return garment.confirmed.some((key) => key !== 'product');
}

/**
 * Apply a patch to one garment against `index` (the garment's release). Throws
 * the command errors of ADMIN-BACKEND §7.1; returns the new garment and the
 * rule-driven impact it includes (already confirmed when non-empty).
 */
export function applyGarmentPatch(
  index: RuntimeIndex,
  garment: Garment,
  patch: GarmentPatch,
  options: ApplyOptions = {},
): ApplyResult {
  let next: Garment = structuredClone(garment);
  let confirmed = new Set<GarmentConfirmation>(garment.confirmed);

  if (patch.productCode !== undefined) {
    const changed = patch.productCode !== garment.productCode;
    if (changed && garment.confirmed.length && !options.confirmCategoryChange)
      throw new DomainError(
        'category_confirmation_required',
        'Changing the garment resets its fabric and finishing choices.',
        409,
      );
    if (changed) {
      const fresh = newGarment(index, patch.productCode, garment.id);
      next = { ...fresh, preferences: { ...garment.preferences }, quantity: garment.quantity };
      confirmed = new Set(garment.confirmed.filter((key) => key === 'preferences'));
    }
    confirmed.add('product');
  }
  const product = index.products.get(next.productCode);
  if (!product)
    throw new DomainError(
      'product_unavailable',
      'This garment is not available in the current catalog.',
      422,
    );

  if (patch.materialCode !== undefined) {
    if (!materialAllowed(index, product.code, patch.materialCode))
      throw new DomainError(
        'incompatible_fabric',
        'This fabric is not available for the selected garment.',
        422,
      );
    if (
      patch.materialCode !== next.materialCode &&
      !isSelectable(options.availability?.[patch.materialCode])
    )
      throw new DomainError('material_unavailable', 'This fabric is currently unavailable.', 409);
    next.materialCode = patch.materialCode;
    confirmed.add('material');
  }

  if (patch.preferences) {
    const { occasion, climate } = patch.preferences;
    if (occasion !== undefined) {
      checkPreference(index, 'occasion', occasion);
      next.preferences.occasion = occasion;
    }
    if (climate !== undefined) {
      checkPreference(index, 'climate', climate);
      next.preferences.climate = climate;
    }
    if (next.preferences.occasion && next.preferences.climate) confirmed.add('preferences');
    else confirmed.delete('preferences');
  }

  if (patch.components) {
    const included = new Set(next.includedComponents);
    for (const [code, include] of Object.entries(patch.components)) {
      const link = product.components.find((item) => item.componentCode === code);
      if (!link || (link.required && !include))
        throw new DomainError(
          'unavailable_option',
          'This part cannot be changed for the selected garment.',
          422,
          { componentCode: code },
        );
      if (include) included.add(code);
      else if (!link.required) included.delete(code);
    }
    next.includedComponents = product.components
      .filter((link) => link.required || included.has(link.componentCode))
      .map((link) => link.componentCode);
  }

  const changed = new Set<string>();
  if (patch.selections) {
    const selections = { ...next.selections };
    for (const [code, raw] of Object.entries(patch.selections)) {
      const value = checkSelection(index, product, code, raw);
      if (value === null) delete selections[code];
      else selections[code] = value;
      changed.add(code);
    }
    next.selections = selections;
  }

  const { garment: resolved, impact } = resolveRules(index, product, next, changed);
  if (impact.length && !options.confirmImpact)
    throw new DomainError(
      'impact_confirmation_required',
      'This change affects other choices. Please review them before continuing.',
      409,
      { impact },
    );
  resolved.confirmed = (['product', 'material', 'preferences', 'details'] as const).filter((key) =>
    confirmed.has(key),
  );
  return { garment: resolved, impact };
}

export type GarmentIssue =
  | { kind: 'product_unavailable' }
  | { kind: 'material_invalid'; materialCode: string }
  | { kind: 'preference_missing'; code: 'occasion' | 'climate' }
  | { kind: 'answer_missing'; attributeCode: string }
  | { kind: 'value_invalid'; attributeCode: string; value: string }
  | { kind: 'rule_violated'; attributeCode: string; ruleCode: string; message: string };

/**
 * Everything that keeps a garment from being accepted, over its effective
 * selections only: hidden (inert) values are never checked (CATALOG-ADMIN §5.2).
 */
export function validateGarment(
  index: RuntimeIndex,
  garment: GarmentShape & Pick<Garment, 'preferences'>,
): { issues: GarmentIssue[]; effective: Effective | null } {
  const product = index.products.get(garment.productCode);
  if (!product) return { issues: [{ kind: 'product_unavailable' }], effective: null };
  const issues: GarmentIssue[] = [];
  if (!materialAllowed(index, product.code, garment.materialCode))
    issues.push({ kind: 'material_invalid', materialCode: garment.materialCode });
  for (const code of ['occasion', 'climate'] as const)
    if (!garment.preferences[code] || !index.lookups.get(code)?.has(garment.preferences[code]!))
      issues.push({ kind: 'preference_missing', code });
  const effective = effectiveSelections(index, garment);
  for (const code of effective.visibleAttributes) {
    const { attribute } = index.attributes.get(code)!;
    const value = effective.selections[code];
    if (value === undefined || value.trim() === '') {
      if (attribute.required) issues.push({ kind: 'answer_missing', attributeCode: code });
      continue;
    }
    try {
      checkSelection(index, product, code, value);
    } catch {
      issues.push({ kind: 'value_invalid', attributeCode: code, value });
    }
  }
  for (const violation of ruleViolations(index, effective))
    issues.push({ kind: 'rule_violated', ...violation });
  return { issues, effective };
}

/**
 * Move a garment to another release (CATALOG-ADMIN §7.8): keep every selection
 * that is still valid, fill new options with their defaults, and list what the
 * customer loses as impact. Price changes are not impact.
 */
export function rebaseGarment(from: RuntimeIndex, to: RuntimeIndex, garment: Garment): ApplyResult {
  const product = to.products.get(garment.productCode);
  if (!product)
    return {
      garment,
      impact: [
        {
          garmentId: garment.id,
          kind: 'product_unavailable',
          message: 'This garment is no longer offered. Remove it or choose another garment.',
        },
      ],
    };
  const impact: Impact[] = [];
  const next: Garment = structuredClone(garment);
  next.catalogVersion = to.catalog.version;
  if (garment.templateCode && !to.templates.has(garment.templateCode)) next.templateCode = null;

  if (!materialAllowed(to, product.code, garment.materialCode)) {
    const name = from.materials.get(garment.materialCode)?.name ?? garment.materialCode;
    next.materialCode = product.defaultMaterialCode;
    next.confirmed = next.confirmed.filter((key) => key !== 'material' && key !== 'details');
    impact.push({
      garmentId: garment.id,
      kind: 'material_unavailable',
      from: garment.materialCode,
      to: product.defaultMaterialCode,
      message: `${name} is no longer offered. We’ve suggested ${to.materials.get(product.defaultMaterialCode)?.name ?? 'the default fabric'} instead.`,
    });
  }

  const included = new Set(
    product.components.filter((link) => link.required).map((l) => l.componentCode),
  );
  const removedParts = new Set<string>();
  for (const code of garment.includedComponents) {
    const link = product.components.find((item) => item.componentCode === code);
    if (link) included.add(code);
    else {
      removedParts.add(code);
      impact.push({
        garmentId: garment.id,
        kind: 'component_removed',
        message: `${from.components.get(code)?.name ?? code} is no longer offered for this garment.`,
      });
    }
  }
  next.includedComponents = product.components
    .filter((link) => included.has(link.componentCode))
    .map((link) => link.componentCode);

  // Selections that were effective before are the customer's; report their losses.
  const before = from.products.has(garment.productCode)
    ? effectiveSelections(from, garment).selections
    : {};
  const defaults = defaultsFor(to, product);
  const selections: Record<string, string> = {};
  for (const [code, value] of Object.entries(garment.selections)) {
    let kept: string | null = null;
    try {
      kept = checkSelection(to, product, code, value);
    } catch {
      kept = null;
    }
    if (kept !== null) {
      selections[code] = kept;
      continue;
    }
    // Choices of a removed part are covered by its component_removed impact.
    const part = from.attributes.get(code)?.component.code;
    if (!(code in before) || (part && removedParts.has(part))) continue;
    const attribute = to.attributes.get(code)?.attribute ?? from.attributes.get(code)?.attribute;
    const replacement = defaults[code];
    const name = attribute?.name ?? code;
    const fromLabel = valueLabel(from, code, value);
    if (replacement !== undefined) selections[code] = replacement;
    impact.push({
      garmentId: garment.id,
      kind: replacement === undefined ? 'selection_removed' : 'selection_replaced',
      attributeCode: code,
      from: value,
      ...(replacement === undefined ? {} : { to: replacement }),
      message:
        replacement === undefined
          ? `${name}: ${fromLabel} is no longer offered.`
          : `${name}: ${fromLabel} is no longer offered and changes to ${valueLabel(to, code, replacement)}.`,
    });
  }
  // New options start at their defaults.
  for (const [code, value] of Object.entries(defaults))
    if (!(code in selections)) selections[code] = value;
  next.selections = selections;

  const resolved = resolveRules(to, product, next, new Set());
  if (impact.length || resolved.impact.length)
    resolved.garment.confirmed = resolved.garment.confirmed.filter((key) => key !== 'details');
  return { garment: resolved.garment, impact: [...impact, ...resolved.impact] };
}
