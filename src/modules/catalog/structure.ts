import { evaluateCondition, type ConditionContext, type ConditionMaterial } from './conditions';
import {
  valueKey,
  type RuntimeAttribute,
  type RuntimeComponent,
  type RuntimeGroup,
  type RuntimeIndex,
  type RuntimeProduct,
  type RuntimeProductComponent,
  type RuntimeValue,
} from './snapshot';

// Defaults, effective selections and the customer tab structure
// (CATALOG-ADMIN.md §2.1, §4, §5.2). Values stored for invisible options are
// kept but inert: they are left out of conditions, validation and prices.
// Visibility is a fixed point over the outline order, with at most 10 passes;
// a catalog whose visibility still changes on the 10th pass is invalid
// (cyclic visibility). Pure and shared by the server and the browser.

export const MAX_VISIBILITY_PASSES = 10;

/** The configuration fields that decide structure, shared by garments and templates. */
export type GarmentShape = {
  productCode: string;
  materialCode: string;
  includedComponents: readonly string[];
  selections: Readonly<Record<string, string>>;
};

export type OutlineEntry = {
  component: RuntimeComponent;
  group: RuntimeGroup;
  attribute: RuntimeAttribute;
};

/** Groups and options of a product's linked parts, in outline order (part link sort, then group, then option). */
export function productOutline(index: RuntimeIndex, product: RuntimeProduct) {
  const groups: { component: RuntimeComponent; group: RuntimeGroup }[] = [];
  for (const link of product.components) {
    const component = index.components.get(link.componentCode);
    if (component) for (const group of component.groups) groups.push({ component, group });
  }
  return groups;
}

export function groupAvailable(product: RuntimeProduct, groupCode: string) {
  return product.settings.groups[groupCode]?.available !== false;
}
export function attributeAvailable(product: RuntimeProduct, attributeCode: string) {
  return product.settings.attributes[attributeCode]?.available !== false;
}
export function valueAvailable(product: RuntimeProduct, attributeCode: string, valueCode: string) {
  return product.settings.values[valueKey(attributeCode, valueCode)]?.available !== false;
}

/** The product-level default (PRICING PRC-003 `productDefault`): product override, else the global default. */
export function productDefault(product: RuntimeProduct, attribute: RuntimeAttribute) {
  const override = product.settings.attributes[attribute.code];
  return override?.defaultValueCode ?? attribute.defaultValueCode;
}

/** Parts included in a garment: required links plus the optional links it includes. */
export function includedComponents(
  product: RuntimeProduct,
  garment: Pick<GarmentShape, 'includedComponents'>,
) {
  return new Set(
    product.components
      .filter((link) => link.required || garment.includedComponents.includes(link.componentCode))
      .map((link) => link.componentCode),
  );
}

/** Default selections for a product: every available choice option with an available default. */
export function defaultsFor(index: RuntimeIndex, product: RuntimeProduct): Record<string, string> {
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
export function defaultGarment(index: RuntimeIndex, product: RuntimeProduct): GarmentShape {
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
  index: RuntimeIndex,
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

export function effectiveSelections(index: RuntimeIndex, garment: GarmentShape): Effective {
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
export function ruleViolations(index: RuntimeIndex, effective: Effective): RuleViolation[] {
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

// Customer tabs (CATALOG-ADMIN §2.1). A presentation rule, derived and never
// stored: Essentials first; for a single-part product its style groups join
// Essentials; otherwise one tab per included part in link order (an optional
// part that is not included keeps its tab with only the include toggle); then
// Accents with every visible accent group, sub-headed by part. Groups with no
// visible option are not shown.

export type StructureAttribute = {
  attribute: RuntimeAttribute;
  /** Choices offered for this product, in sort order (unavailable ones removed). */
  values: RuntimeValue[];
  /** The effective value: set only while the option is visible. */
  value: string | undefined;
  /** The product default, when it is an offered choice. */
  defaultValue: string | null;
};
export type StructureGroup = {
  group: RuntimeGroup;
  component: RuntimeComponent;
  attributes: StructureAttribute[];
};
export type StructureInclude = {
  componentCode: string;
  /** Customer label for the toggle (“Add a vest”), falling back to the part name. */
  label: string;
  included: boolean;
};
export type StructureTab = {
  /** `essentials`, the component code, or `accents`. */
  id: string;
  kind: 'essentials' | 'component' | 'accents';
  label: string;
  component: RuntimeComponent | null;
  include: StructureInclude | null;
  groups: StructureGroup[];
};
export type VisibleStructure = {
  product: RuntimeProduct;
  effective: Effective;
  tabs: StructureTab[];
};

function offeredValues(product: RuntimeProduct, attribute: RuntimeAttribute) {
  return attribute.values.filter((value) => valueAvailable(product, attribute.code, value.code));
}

function structureGroup(
  product: RuntimeProduct,
  component: RuntimeComponent,
  group: RuntimeGroup,
  effective: Effective,
): StructureGroup | null {
  if (!effective.visibleGroups.has(group.code)) return null;
  const attributes = group.attributes
    .filter((attribute) => effective.visibleAttributes.has(attribute.code))
    .map((attribute) => {
      const values = offeredValues(product, attribute);
      const fallback = productDefault(product, attribute);
      return {
        attribute,
        values,
        value: effective.selections[attribute.code],
        defaultValue: values.some((value) => value.code === fallback) ? fallback : null,
      };
    });
  return attributes.length ? { group, component, attributes } : null;
}

/** The customer tabs for a garment, with the visible groups, options and choices of each. */
export function visibleStructure(
  index: RuntimeIndex,
  garment: GarmentShape,
): VisibleStructure | null {
  const product = index.products.get(garment.productCode);
  if (!product) return null;
  const effective = effectiveSelections(index, garment);
  const links = product.components
    .map((link) => ({ link, component: index.components.get(link.componentCode) }))
    .filter(
      (item): item is { link: RuntimeProductComponent; component: RuntimeComponent } =>
        !!item.component,
    );
  const groupsOf = (component: RuntimeComponent, kind: RuntimeGroup['kind']) =>
    component.groups
      .filter((group) => group.kind === kind && groupAvailable(product, group.code))
      .map((group) => structureGroup(product, component, group, effective))
      .filter((group): group is StructureGroup => !!group);

  const essentials: StructureTab = {
    id: 'essentials',
    kind: 'essentials',
    label: 'The essentials',
    component: null,
    include: null,
    groups: [],
  };
  const tabs: StructureTab[] = [essentials];
  if (links.length === 1) essentials.groups.push(...groupsOf(links[0].component, 'style'));
  else
    for (const { link, component } of links) {
      const included = effective.context.includedComponents.has(component.code);
      tabs.push({
        id: component.code,
        kind: 'component',
        label: component.name,
        component,
        include: link.required
          ? null
          : { componentCode: component.code, label: link.includeLabel || component.name, included },
        groups: included ? groupsOf(component, 'style') : [],
      });
    }
  const accents = links.flatMap(({ component }) =>
    effective.context.includedComponents.has(component.code) ? groupsOf(component, 'accent') : [],
  );
  if (accents.length)
    tabs.push({
      id: 'accents',
      kind: 'accents',
      label: 'Accents',
      component: null,
      include: null,
      groups: accents,
    });
  return { product, effective, tabs };
}
