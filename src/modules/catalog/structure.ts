import { evaluateCondition, type ConditionContext, type ConditionMaterial } from './conditions';
import {
  valueKey,
  type CatalogIndex,
  type SnapshotAttribute,
  type SnapshotComponent,
  type SnapshotGroup,
  type SnapshotProduct,
} from './snapshot';

// Defaults and effective selections (CATALOG-ADMIN.md §5.2). Values stored for
// invisible options are kept but inert: they are left out of conditions,
// validation and prices. Visibility is a fixed point over the outline order,
// with at most 10 passes; a catalog whose visibility still changes on the 10th
// pass is invalid (cyclic visibility). WP-09 adds the customer tab structure.

export const MAX_VISIBILITY_PASSES = 10;

/** The configuration fields that decide structure, shared by garments and templates. */
export type GarmentShape = {
  productCode: string;
  materialCode: string;
  includedComponents: readonly string[];
  selections: Readonly<Record<string, string>>;
};

export type OutlineEntry = {
  component: SnapshotComponent;
  group: SnapshotGroup;
  attribute: SnapshotAttribute;
};

/** Groups and options of a product's linked parts, in outline order (part link sort, then group, then option). */
export function productOutline(index: CatalogIndex, product: SnapshotProduct) {
  const groups: { component: SnapshotComponent; group: SnapshotGroup }[] = [];
  for (const link of product.components) {
    const component = index.components.get(link.componentCode);
    if (component) for (const group of component.groups) groups.push({ component, group });
  }
  return groups;
}

export function groupAvailable(product: SnapshotProduct, groupCode: string) {
  return product.settings.groups[groupCode]?.available !== false;
}
export function attributeAvailable(product: SnapshotProduct, attributeCode: string) {
  return product.settings.attributes[attributeCode]?.available !== false;
}
export function valueAvailable(product: SnapshotProduct, attributeCode: string, valueCode: string) {
  return product.settings.values[valueKey(attributeCode, valueCode)]?.available !== false;
}

/** The product-level default (PRICING PRC-003 `productDefault`): product override, else the global default. */
export function productDefault(product: SnapshotProduct, attribute: SnapshotAttribute) {
  const override = product.settings.attributes[attribute.code];
  return override?.defaultValueCode ?? attribute.defaultValueCode;
}

/** Parts included in a garment: required links plus the optional links it includes. */
export function includedComponents(
  product: SnapshotProduct,
  garment: Pick<GarmentShape, 'includedComponents'>,
) {
  return new Set(
    product.components
      .filter((link) => link.required || garment.includedComponents.includes(link.componentCode))
      .map((link) => link.componentCode),
  );
}

/** Default selections for a product: every available choice option with an available default. */
export function defaultsFor(index: CatalogIndex, product: SnapshotProduct): Record<string, string> {
  const selections: Record<string, string> = {};
  for (const { group } of productOutline(index, product)) {
    if (!groupAvailable(product, group.code)) continue;
    for (const attribute of group.attributes) {
      if (attribute.inputType !== 'choice' || !attributeAvailable(product, attribute.code))
        continue;
      const code = productDefault(product, attribute);
      if (
        code !== null &&
        attribute.values.some((value) => value.code === code) &&
        valueAvailable(product, attribute.code, code)
      )
        selections[attribute.code] = code;
    }
  }
  return selections;
}

/** A garment with a product's defaults: default material, default parts and default choices. */
export function defaultGarment(index: CatalogIndex, product: SnapshotProduct): GarmentShape {
  return {
    productCode: product.code,
    materialCode: product.defaultMaterialCode,
    includedComponents: product.components
      .filter((link) => link.required || link.defaultIncluded)
      .map((link) => link.componentCode),
    selections: defaultsFor(index, product),
  };
}

export function conditionMaterial(
  index: CatalogIndex,
  materialCode: string,
): ConditionMaterial | null {
  const material = index.materials.get(materialCode);
  return material
    ? {
        code: material.code,
        pattern: material.pattern || null,
        weave: material.weave,
        colourFamily: material.colourFamily,
        stretch: material.stretch,
      }
    : null;
}

export type Effective = {
  /** Values of visible options only. */
  selections: Record<string, string>;
  visibleGroups: Set<string>;
  visibleAttributes: Set<string>;
  context: ConditionContext;
  passes: number;
  /** False when visibility still changed on the last pass (cyclic visibility). */
  stable: boolean;
};

export function effectiveSelections(index: CatalogIndex, garment: GarmentShape): Effective {
  const product = index.products.get(garment.productCode);
  const included = product ? includedComponents(product, garment) : new Set<string>();
  const outline = product
    ? productOutline(index, product).filter(
        ({ component, group }) =>
          included.has(component.code) && groupAvailable(product, group.code),
      )
    : [];
  const material = conditionMaterial(index, garment.materialCode);
  let visible = new Set(
    outline.flatMap(({ group }) =>
      group.attributes
        .filter((attribute) => attributeAvailable(product!, attribute.code))
        .map((attribute) => attribute.code),
    ),
  );
  let current: Record<string, string> = {};
  for (const code of visible)
    if (garment.selections[code] !== undefined) current[code] = garment.selections[code];
  let visibleGroups = new Set<string>();
  for (let pass = 1; pass <= MAX_VISIBILITY_PASSES; pass++) {
    const selections = { ...current };
    const context: ConditionContext = {
      productCode: garment.productCode,
      includedComponents: included,
      selections,
      material,
    };
    const nextVisible = new Set<string>();
    visibleGroups = new Set<string>();
    for (const { group } of outline) {
      const groupShown = !group.visibleWhen || evaluateCondition(group.visibleWhen, context);
      if (groupShown) visibleGroups.add(group.code);
      for (const attribute of group.attributes) {
        const shown =
          groupShown &&
          attributeAvailable(product!, attribute.code) &&
          (!attribute.visibleWhen || evaluateCondition(attribute.visibleWhen, context));
        if (shown) {
          nextVisible.add(attribute.code);
          if (garment.selections[attribute.code] !== undefined)
            selections[attribute.code] = garment.selections[attribute.code];
        } else delete selections[attribute.code];
      }
    }
    const settled =
      nextVisible.size === visible.size && [...nextVisible].every((code) => visible.has(code));
    visible = nextVisible;
    current = selections;
    if (settled)
      return {
        selections,
        visibleGroups,
        visibleAttributes: visible,
        context,
        passes: pass,
        stable: true,
      };
  }
  return {
    selections: current,
    visibleGroups,
    visibleAttributes: visible,
    context: {
      productCode: garment.productCode,
      includedComponents: included,
      selections: current,
      material,
    },
    passes: MAX_VISIBILITY_PASSES,
    stable: false,
  };
}

export type RuleViolation = { ruleCode: string; attributeCode: string; message: string };

/** Forbid and require rules over effective selections (CATALOG-ADMIN §5.3); only visible targets are checked. */
export function ruleViolations(index: CatalogIndex, effective: Effective): RuleViolation[] {
  const violations: RuleViolation[] = [];
  for (const rule of index.rules.values()) {
    if (rule.productCodes.length && !rule.productCodes.includes(effective.context.productCode))
      continue;
    if (!effective.visibleAttributes.has(rule.attributeCode)) continue;
    if (!evaluateCondition(rule.when, effective.context)) continue;
    const value = effective.selections[rule.attributeCode];
    const listed = value !== undefined && rule.valueCodes.includes(value);
    if (rule.effect === 'forbid' ? listed : !listed)
      violations.push({
        ruleCode: rule.code,
        attributeCode: rule.attributeCode,
        message: rule.message,
      });
  }
  return violations;
}
