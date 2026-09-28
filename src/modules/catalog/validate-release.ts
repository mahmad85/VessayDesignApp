import { canonicalJson, checksum } from '@/lib/canonical-json';
import { isSupportedCurrency, safeParseMoney } from '@/lib/money';
import { MEASUREMENTS } from '../measurements/definitions';
import { validateCondition } from './conditions';
import {
  indexSnapshot,
  valueKey,
  type CatalogIndex,
  type CatalogSnapshot,
  type RuntimeAttribute,
  type RuntimeProduct,
  type SnapshotProduct,
} from './snapshot';
import {
  attributeAvailable,
  defaultGarment,
  effectiveSelections,
  groupAvailable,
  productDefault,
  productOutline,
  ruleViolations,
  valueAvailable,
  type GarmentShape,
} from './structure';
import { isRegionId, isSlotId, isTokenOf } from '@/visualization/registry';
import type { VisualModel } from '@/visualization/registry';

// Release validation catalogue (CATALOG-ADMIN.md §7.4, CAT-003). Errors block
// publishing; warnings must be acknowledged with the checksum of the current
// warning list. Every issue names the entity it belongs to, for admin badges.

export const RELEASE_ERROR_CODES = [
  'product_no_components',
  'product_invalid_registry',
  'product_default_material',
  'attribute_no_values',
  'default_invalid',
  'text_rules_missing',
  'condition_invalid',
  'rule_violated_by_defaults',
  'template_invalid',
  'material_incomplete',
  'composition_sum',
  'visual_token_unknown',
  'focus_region_unknown',
  'metadata_invalid',
  'lookup_unknown',
  'currency_invalid',
  'release_too_large',
] as const;
export const RELEASE_WARNING_CODES = [
  'price_missing',
  'reference_price_unset',
  'image_missing',
  'rights_unconfirmed',
  'reference_only_present',
  'not_illustrated',
  'supplier_missing',
  'lookup_inactive_in_use',
] as const;
export type ReleaseErrorCode = (typeof RELEASE_ERROR_CODES)[number];
export type ReleaseWarningCode = (typeof RELEASE_WARNING_CODES)[number];
export type EntityType =
  | 'catalog'
  | 'product'
  | 'component'
  | 'group'
  | 'attribute'
  | 'value'
  | 'material'
  | 'rule'
  | 'template'
  | 'media';
export type ValidationIssue<C extends string = string> = {
  code: C;
  entity: EntityType;
  /** The entity's code; `attributeCode::valueCode` for a choice, the id for media. */
  entityCode: string;
  productCode?: string;
  message: string;
};
export type ValidationReport = {
  errors: ValidationIssue<ReleaseErrorCode>[];
  warnings: ValidationIssue<ReleaseWarningCode>[];
  warningsChecksum: string;
};
export type ValidationOptions = {
  /** Inactive lookup values by type (compile.ts#inactiveLookups). */
  inactiveLookups?: Record<string, readonly string[]>;
};

/** Largest release accepted (ADMIN-BACKEND §5). */
export const MAX_RELEASE_BYTES = 5 * 1024 * 1024;
const MEASUREMENT_SETS = new Set(
  MEASUREMENTS.flatMap((item) => item.products as readonly string[]),
);
const VISUAL_MODELS = new Set<VisualModel>(['suit', 'shirt', 'blazer']);
/** Choice metadata keys the importer and system own; everything else must be declared. */
const SYSTEM_METADATA = /^(referencePrice|sourceLabel|source[A-Z].*)$/;

const compare = (a: ValidationIssue, b: ValidationIssue) =>
  a.code.localeCompare(b.code) ||
  a.entity.localeCompare(b.entity) ||
  a.entityCode.localeCompare(b.entityCode) ||
  (a.productCode ?? '').localeCompare(b.productCode ?? '') ||
  a.message.localeCompare(b.message);

export function validateRelease(
  snapshot: CatalogSnapshot,
  options: ValidationOptions = {},
): ValidationReport {
  const index = indexSnapshot(snapshot);
  const errors: ValidationIssue<ReleaseErrorCode>[] = [];
  const warnings: ValidationIssue<ReleaseWarningCode>[] = [];
  const error = (
    code: ReleaseErrorCode,
    entity: EntityType,
    entityCode: string,
    message: string,
    productCode?: string,
  ) => errors.push({ code, entity, entityCode, message, ...(productCode ? { productCode } : {}) });
  const warn = (
    code: ReleaseWarningCode,
    entity: EntityType,
    entityCode: string,
    message: string,
    productCode?: string,
  ) =>
    warnings.push({ code, entity, entityCode, message, ...(productCode ? { productCode } : {}) });

  checkCatalog(snapshot, error);
  checkConditions(snapshot, index, error);
  for (const product of snapshot.products) checkProduct(index, product, error, warn);
  checkChoices(snapshot, index, error, warn);
  checkMaterials(snapshot, index, error, warn);
  checkTemplates(snapshot, index, error);
  checkLookups(snapshot, index, options.inactiveLookups ?? {}, error, warn);
  checkMedia(snapshot, index, warn);
  checkVisibility(snapshot, index, error);

  const uniqueErrors = dedupe(errors).sort(compare);
  const uniqueWarnings = dedupe(warnings).sort(compare);
  return {
    errors: uniqueErrors,
    warnings: uniqueWarnings,
    warningsChecksum: checksum(uniqueWarnings),
  };
}

function dedupe<T extends ValidationIssue>(issues: T[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = canonicalJson(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type Report<C extends string> = (
  code: C,
  entity: EntityType,
  entityCode: string,
  message: string,
  productCode?: string,
) => unknown;

function checkCatalog(snapshot: CatalogSnapshot, error: Report<ReleaseErrorCode>) {
  if (!isSupportedCurrency(snapshot.currency))
    error(
      'currency_invalid',
      'catalog',
      snapshot.currency,
      `The currency ${snapshot.currency} is not supported. Use one with two decimals, such as USD or EUR.`,
    );
  const bytes = Buffer.byteLength(canonicalJson(snapshot));
  if (bytes > MAX_RELEASE_BYTES)
    error(
      'release_too_large',
      'catalog',
      'release',
      `The catalog is ${(bytes / 1048576).toFixed(1)} MB; a release can be at most 5 MB.`,
    );
}

function checkConditions(
  snapshot: CatalogSnapshot,
  index: CatalogIndex,
  error: Report<ReleaseErrorCode>,
) {
  const report = (entity: EntityType, code: string, condition: unknown, what: string) => {
    for (const issue of validateCondition(condition, index))
      error('condition_invalid', entity, code, `${what}: ${issue.message}`);
  };
  for (const component of snapshot.components)
    for (const group of component.groups) {
      if (group.visibleWhen) report('group', group.code, group.visibleWhen, 'Show when');
      for (const attribute of group.attributes)
        if (attribute.visibleWhen)
          report('attribute', attribute.code, attribute.visibleWhen, 'Show when');
    }
  for (const rule of snapshot.rules) {
    report('rule', rule.code, rule.when, 'Rule condition');
    const target = index.attributes.get(rule.attributeCode);
    if (!target)
      error(
        'condition_invalid',
        'rule',
        rule.code,
        `The rule targets an unknown option “${rule.attributeCode}”.`,
      );
    else
      for (const value of rule.valueCodes)
        if (!index.values.has(valueKey(rule.attributeCode, value)))
          error(
            'condition_invalid',
            'rule',
            rule.code,
            `The rule lists an unknown choice “${value}”.`,
          );
    for (const product of rule.productCodes)
      if (!index.products.has(product))
        error(
          'condition_invalid',
          'rule',
          rule.code,
          `The rule names an unknown product “${product}”.`,
        );
  }
}

function checkProduct(
  index: CatalogIndex,
  product: SnapshotProduct,
  error: Report<ReleaseErrorCode>,
  warn: Report<ReleaseWarningCode>,
) {
  const links = product.components.filter((link) => index.components.has(link.componentCode));
  if (!links.length || !links.some((link) => link.required))
    error(
      'product_no_components',
      'product',
      product.code,
      'A product needs at least one active part, and at least one required part.',
    );
  if (!MEASUREMENT_SETS.has(product.measurementSet) || !VISUAL_MODELS.has(product.visualModel))
    error(
      'product_invalid_registry',
      'product',
      product.code,
      'The measurement set and drawing model must be ones the application supports.',
    );
  const material = index.materials.get(product.defaultMaterialCode);
  if (!material || !material.productCodes.includes(product.code))
    error(
      'product_default_material',
      'product',
      product.code,
      'The default fabric must be an active fabric offered for this product.',
    );
  if (!Object.keys(product.bandPrices).length)
    warn(
      'price_missing',
      'product',
      product.code,
      'This product has no band prices; its quote is unavailable.',
    );

  for (const { group } of productOutline(index, product)) {
    if (!groupAvailable(product, group.code)) continue;
    for (const attribute of group.attributes) {
      if (!attributeAvailable(product, attribute.code)) continue;
      checkDefault(product, attribute, error);
      if (
        attribute.inputType === 'choice' &&
        !attribute.values.some((value) => valueAvailable(product, attribute.code, value.code))
      )
        error(
          'attribute_no_values',
          'attribute',
          attribute.code,
          'This option has no available choices for this product.',
          product.code,
        );
    }
  }

  // Every product's defaults must satisfy every rule: as offered, and with every optional part added.
  const base = defaultGarment(index, product);
  const variants: GarmentShape[] = [
    base,
    { ...base, includedComponents: product.components.map((link) => link.componentCode) },
  ];
  for (const garment of variants)
    for (const violation of ruleViolations(index, effectiveSelections(index, garment)))
      error(
        'rule_violated_by_defaults',
        'rule',
        violation.ruleCode,
        `The product defaults break this rule: ${violation.message}`,
        product.code,
      );
}

function checkDefault(
  product: RuntimeProduct,
  attribute: RuntimeAttribute,
  error: Report<ReleaseErrorCode>,
) {
  const code = productDefault(product, attribute);
  if (code === null) return;
  if (
    attribute.inputType !== 'choice' ||
    !attribute.values.some((value) => value.code === code) ||
    !valueAvailable(product, attribute.code, code)
  )
    error(
      'default_invalid',
      'attribute',
      attribute.code,
      `The default choice “${code}” is not an available active choice of this option.`,
      product.code,
    );
}

function checkChoices(
  snapshot: CatalogSnapshot,
  index: CatalogIndex,
  error: Report<ReleaseErrorCode>,
  warn: Report<ReleaseWarningCode>,
) {
  for (const component of snapshot.components)
    for (const group of component.groups) {
      if (!isRegionId(group.focusRegion))
        error(
          'focus_region_unknown',
          'group',
          group.code,
          group.focusRegion
            ? `“${group.focusRegion}” is not an area of the drawing.`
            : 'Choose the area of the drawing this group shows.',
        );
      if (!group.iconMediaId || !index.media.get(group.iconMediaId)?.alt.trim())
        warn(
          'image_missing',
          'group',
          group.code,
          'The group has no icon, or its icon has no alt text.',
        );
      for (const attribute of group.attributes) {
        if (attribute.inputType === 'text') {
          const rules = attribute.textRules;
          let valid = !!rules && Number.isInteger(rules.maxLength) && rules.maxLength >= 1;
          if (valid && rules!.pattern)
            try {
              new RegExp(rules!.pattern);
            } catch {
              valid = false;
            }
          if (!valid)
            error(
              'text_rules_missing',
              'attribute',
              attribute.code,
              'A text option needs a maximum length (1–60) and, if set, a valid pattern.',
            );
        }
        const slot = attribute.visualSlot;
        if (slot !== null && !isSlotId(slot))
          error(
            'visual_token_unknown',
            'attribute',
            attribute.code,
            `“${slot}” is not a drawing slot.`,
          );
        for (const value of attribute.values) {
          const code = valueKey(attribute.code, value.code);
          if (
            value.visualToken !== null &&
            (!slot || !isSlotId(slot) || !isTokenOf(slot, value.visualToken))
          )
            error(
              'visual_token_unknown',
              'value',
              code,
              `The drawing cannot show “${value.visualToken}” for this option.`,
            );
          if (slot && value.visualToken === null)
            warn(
              'not_illustrated',
              'value',
              code,
              'This choice is not illustrated; customers see its name only.',
            );
          if (!value.imageMediaId || !index.media.get(value.imageMediaId)?.alt.trim())
            warn(
              'image_missing',
              'value',
              code,
              'The choice has no image, or its image has no alt text.',
            );
          const reference = value.metadata.referencePrice;
          if (reference !== undefined && value.surchargeMinor === 0) {
            const parsed = safeParseMoney(String(reference));
            if (parsed.ok && parsed.minor > 0)
              warn(
                'reference_price_unset',
                'value',
                code,
                `The imported reference price is ${reference} but no surcharge is set.`,
              );
          }
          const fields = new Map(attribute.metadataFields.map((field) => [field.key, field]));
          for (const field of attribute.metadataFields) {
            const item = value.metadata[field.key];
            const wrongType =
              item !== undefined &&
              (field.type === 'number'
                ? typeof item !== 'number'
                : field.type === 'boolean'
                  ? typeof item !== 'boolean'
                  : typeof item !== 'string');
            if ((field.required && (item === undefined || item === '')) || wrongType)
              error(
                'metadata_invalid',
                'value',
                code,
                `“${field.label}” is missing or has the wrong type.`,
              );
          }
          for (const key of Object.keys(value.metadata))
            if (!fields.has(key) && !SYSTEM_METADATA.test(key))
              error('metadata_invalid', 'value', code, `“${key}” is not a field of this option.`);
        }
      }
    }
}

function checkMaterials(
  snapshot: CatalogSnapshot,
  index: CatalogIndex,
  error: Report<ReleaseErrorCode>,
  warn: Report<ReleaseWarningCode>,
) {
  for (const material of snapshot.materials) {
    const missing = [
      !material.name.trim() && 'name',
      !material.primaryHex && 'primary colour',
      !material.pattern && 'pattern',
      !material.media.some((item) => item.role === 'swatch' && index.media.has(item.mediaId)) &&
        'swatch',
      !material.usages.length && 'usages',
      !material.productCodes.length && 'products',
    ].filter(Boolean);
    if (missing.length)
      error(
        'material_incomplete',
        'material',
        material.code,
        `The fabric is missing: ${missing.join(', ')}.`,
      );
    if (material.composition.length) {
      const total = material.composition.reduce((sum, item) => sum + item.percent, 0);
      if (total !== 100)
        error(
          'composition_sum',
          'material',
          material.code,
          `The composition adds up to ${total}%, not 100%.`,
        );
    }
    if (!material.supplier || !material.supplier.articleCode)
      warn(
        'supplier_missing',
        'material',
        material.code,
        'The fabric has no supplier or supplier article code.',
      );
    for (const productCode of material.productCodes) {
      const product = index.products.get(productCode);
      if (!product) continue;
      const band = material.priceBand;
      const priced =
        material.priceOverrides[productCode] !== undefined ||
        (band !== null && product.bandPrices[band] !== undefined);
      if (!priced)
        warn(
          'price_missing',
          'material',
          material.code,
          'This fabric has no band price or override for the product; its quote is unavailable.',
          productCode,
        );
    }
  }
}

function checkTemplates(
  snapshot: CatalogSnapshot,
  index: CatalogIndex,
  error: Report<ReleaseErrorCode>,
) {
  for (const template of snapshot.templates) {
    const problems: string[] = [];
    const product = index.products.get(template.productCode);
    if (!product) problems.push('its product is not active');
    const material = index.materials.get(template.materialCode);
    if (!material || (product && !material.productCodes.includes(product.code)))
      problems.push('its fabric is not active or not offered for the product');
    if (product) {
      for (const code of template.includedComponents)
        if (
          !product.components.some(
            (link) => link.componentCode === code && index.components.has(code),
          )
        )
          problems.push(`part “${code}” is not a part of the product`);
      for (const [code, value] of Object.entries(template.selections)) {
        const item = index.attributes.get(code);
        const reachable =
          item &&
          product.components.some((link) => link.componentCode === item.component.code) &&
          groupAvailable(product, item.group.code) &&
          attributeAvailable(product, code);
        if (!item || !reachable) problems.push(`option “${code}” is not available for the product`);
        else if (
          item.attribute.inputType === 'choice' &&
          (!index.values.has(valueKey(code, value)) || !valueAvailable(product, code, value))
        )
          problems.push(`choice “${value}” is not available for “${code}”`);
      }
      const garment: GarmentShape = {
        productCode: product.code,
        materialCode: template.materialCode,
        includedComponents: template.includedComponents,
        selections: { ...defaultGarment(index, product).selections, ...template.selections },
      };
      const effective = effectiveSelections(index, garment);
      for (const code of effective.visibleAttributes) {
        const attribute = index.attributes.get(code)!.attribute;
        const answer = effective.selections[code];
        if (attribute.required && (answer === undefined || answer.trim() === ''))
          problems.push(`“${attribute.name}” has no answer`);
      }
      for (const violation of ruleViolations(index, effective)) problems.push(violation.message);
    }
    if (problems.length)
      error(
        'template_invalid',
        'template',
        template.code,
        `This look is not valid: ${problems.join('; ')}.`,
      );
  }
}

function checkLookups(
  snapshot: CatalogSnapshot,
  index: CatalogIndex,
  inactive: Record<string, readonly string[]>,
  error: Report<ReleaseErrorCode>,
  warn: Report<ReleaseWarningCode>,
) {
  const check = (
    entity: EntityType,
    code: string,
    type: string,
    value: string | null | undefined,
  ) => {
    if (value === null || value === undefined || value === '') return;
    if (index.lookups.get(type)?.has(value)) return;
    if (inactive[type]?.includes(value))
      warn(
        'lookup_inactive_in_use',
        entity,
        code,
        `The ${type} value “${value}” is deactivated but still used.`,
      );
    else error('lookup_unknown', entity, code, `“${value}” is not a ${type} value.`);
  };
  for (const material of snapshot.materials) {
    const code = material.code;
    check('material', code, 'colour_family', material.colourFamily);
    check('material', code, 'pattern', material.pattern);
    check('material', code, 'weave', material.weave);
    check('material', code, 'texture', material.texture);
    check('material', code, 'sheen', material.sheen);
    check('material', code, 'stretch', material.stretch);
    for (const value of material.finishes) check('material', code, 'finish', value);
    for (const value of material.seasons) check('material', code, 'season', value);
    for (const value of material.climates) check('material', code, 'climate', value);
    for (const value of material.occasions) check('material', code, 'occasion', value);
    for (const value of material.care) check('material', code, 'care', value);
    for (const value of material.tags) check('material', code, 'tag', value);
    for (const item of material.composition) check('material', code, 'fibre', item.fibre);
  }
  for (const template of snapshot.templates) {
    for (const value of template.occasions) check('template', template.code, 'occasion', value);
    for (const value of template.climates) check('template', template.code, 'climate', value);
  }
  for (const component of snapshot.components)
    for (const group of component.groups)
      for (const attribute of group.attributes)
        for (const field of attribute.metadataFields)
          if (field.type === 'lookup' && field.lookupType)
            for (const value of attribute.values) {
              const item = value.metadata[field.key];
              if (typeof item === 'string')
                check('value', valueKey(attribute.code, value.code), field.lookupType, item);
            }
}

function checkMedia(
  snapshot: CatalogSnapshot,
  index: CatalogIndex,
  warn: Report<ReleaseWarningCode>,
) {
  for (const product of snapshot.products)
    if (!product.heroMediaId || !index.media.get(product.heroMediaId)?.alt.trim())
      warn(
        'image_missing',
        'product',
        product.code,
        'The product has no hero image, or it has no alt text.',
      );
  for (const template of snapshot.templates)
    if (!template.heroMediaId || !index.media.get(template.heroMediaId)?.alt.trim())
      warn(
        'image_missing',
        'template',
        template.code,
        'The look has no hero image, or it has no alt text.',
      );
  for (const media of Object.values(snapshot.media))
    if (media.rightsStatus === 'unknown' || media.rightsStatus === 'reference_only')
      warn(
        'rights_unconfirmed',
        'media',
        media.id,
        media.rightsStatus === 'unknown'
          ? 'The image rights are unknown.'
          : 'The image is reference-only and not cleared for publication.',
      );
  if (snapshot.referenceOnly)
    warn(
      'reference_only_present',
      'catalog',
      'release',
      'This release contains reference-only data, so it cannot be ordered in production.',
    );
}

/** Cyclic visibility: the fixed point must settle for every product's defaults and every look. */
function checkVisibility(
  snapshot: CatalogSnapshot,
  index: CatalogIndex,
  error: Report<ReleaseErrorCode>,
) {
  for (const product of snapshot.products) {
    const base = defaultGarment(index, product);
    for (const garment of [
      base,
      { ...base, includedComponents: product.components.map((link) => link.componentCode) },
    ])
      if (!effectiveSelections(index, garment).stable)
        error(
          'condition_invalid',
          'product',
          product.code,
          'The show-when conditions depend on each other in a loop and never settle.',
        );
  }
  for (const template of snapshot.templates) {
    const product = index.products.get(template.productCode);
    if (!product) continue;
    const garment: GarmentShape = {
      productCode: product.code,
      materialCode: template.materialCode,
      includedComponents: template.includedComponents,
      selections: { ...defaultGarment(index, product).selections, ...template.selections },
    };
    if (!effectiveSelections(index, garment).stable)
      error(
        'condition_invalid',
        'template',
        template.code,
        'The show-when conditions depend on each other in a loop and never settle.',
      );
  }
}
