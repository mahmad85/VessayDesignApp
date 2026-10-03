import type { AvailabilityMap } from '../catalog/garment';
import { isSelectable, materialAllowed, validateGarment } from '../catalog/garment';
import {
  valueKey,
  type RuntimeAttribute,
  type RuntimeIndex,
  type RuntimeProduct,
  type RuntimeProductComponent,
} from '../catalog/snapshot';
import type { DraftV2, Garment } from '../configuration/types';

// The only price calculator (PRICING.md PRC-002 – PRC-005). Pure and
// deterministic over one catalog release: the customer runtime, the admin
// simulator, look prices and order submission all call it. Amounts are
// integers in minor units. Unknown is never zero: a missing base price makes
// the quote unavailable.

export type QuoteLine = {
  /** `group` and `attribute` lines appear only in quotes persisted before D-022. */
  kind: 'base' | 'component' | 'group' | 'attribute' | 'option';
  /** `base`, a component code, or `accents`. */
  category: string;
  categoryLabel: string;
  label: string;
  /** Product, component, group or attribute code, or `${attributeCode}::${valueCode}`. */
  ref: string;
  lineKind: 'construction' | 'accessory';
  /** Per unit. */
  amountMinor: number;
};
export type QuoteUnavailableReason =
  'base_price_missing' | 'material_unavailable' | 'invalid_configuration';
export type CategoryTotal = { category: string; label: string; amountMinor: number };
export type GarmentQuote =
  | {
      status: 'priced';
      garmentId: string;
      currency: string;
      catalogVersion: number;
      lines: QuoteLine[];
      unitMinor: number;
      quantity: number;
      totalMinor: number;
      byCategory: CategoryTotal[];
    }
  | {
      status: 'unavailable';
      garmentId: string;
      currency: string;
      catalogVersion: number;
      reasons: QuoteUnavailableReason[];
    };
export type CartQuote = {
  status: 'priced' | 'unavailable';
  currency: string;
  catalogVersion: number;
  garments: GarmentQuote[];
  /** Null while any garment is unpriced or the cart is empty: never shown as zero. */
  subtotalMinor: number | null;
  shippingMinor: number | null;
  totalMinor: number | null;
};

// Extra charges (PRC-003, D-022): an optional part and a chosen choice. Groups
// and options carry no charge; a per-product choice override survives only in
// releases published before D-022.
export function componentSurcharge(link: RuntimeProductComponent) {
  return link.surchargeMinor;
}
export function valueSurcharge(
  product: RuntimeProduct,
  attribute: RuntimeAttribute,
  valueCode: string,
) {
  const override = product.settings.values[valueKey(attribute.code, valueCode)];
  const value = attribute.values.find((item) => item.code === valueCode);
  return override?.surchargeOverrideMinor ?? value?.surchargeMinor ?? 0;
}

/** PRC-002: the fabric's own price for the product, else the product's band price. */
export function basePrice(index: RuntimeIndex, product: RuntimeProduct, materialCode: string) {
  const material = index.materials.get(materialCode);
  if (!material) return null;
  const override = material.priceOverrides[product.code];
  if (override !== undefined) return { amountMinor: override, band: null };
  if (material.priceBand && product.bandPrices[material.priceBand] !== undefined)
    return { amountMinor: product.bandPrices[material.priceBand], band: material.priceBand };
  return null;
}

const INVALID = new Set([
  'product_unavailable',
  'material_invalid',
  'value_invalid',
  'rule_violated',
]);

export function quoteGarment(
  index: RuntimeIndex,
  garment: Garment,
  availability: AvailabilityMap = {},
): GarmentQuote {
  const currency = index.catalog.currency;
  const catalogVersion = index.catalog.version;
  const unavailable = (reasons: QuoteUnavailableReason[]): GarmentQuote => ({
    status: 'unavailable',
    garmentId: garment.id,
    currency,
    catalogVersion,
    reasons,
  });
  const product = index.products.get(garment.productCode);
  if (!product) return unavailable(['invalid_configuration']);
  const reasons: QuoteUnavailableReason[] = [];
  const { issues, effective } = validateGarment(index, garment);
  const base = basePrice(index, product, garment.materialCode);
  if (!base && materialAllowed(index, product.code, garment.materialCode))
    reasons.push('base_price_missing');
  if (!isSelectable(availability[garment.materialCode])) reasons.push('material_unavailable');
  if (issues.some((issue) => INVALID.has(issue.kind))) reasons.push('invalid_configuration');
  if (reasons.length || !base || !effective) return unavailable(reasons);

  const material = index.materials.get(garment.materialCode)!;
  const band = base.band ? index.catalog.priceBands.find((item) => item.code === base.band) : null;
  const lines: QuoteLine[] = [
    {
      kind: 'base',
      category: 'base',
      categoryLabel: `${product.shortLabel} · ${band ? band.name : material.name}`,
      label: `${product.name} in ${material.name}`,
      ref: product.code,
      lineKind: 'construction',
      amountMinor: base.amountMinor,
    },
  ];
  const included = effective.context.includedComponents;
  for (const link of product.components) {
    const component = index.components.get(link.componentCode);
    if (!component || !included.has(component.code)) continue;
    const componentMinor = componentSurcharge(link);
    if (componentMinor > 0)
      lines.push({
        kind: 'component',
        category: component.code,
        categoryLabel: component.name,
        label: link.includeLabel ?? component.name,
        ref: component.code,
        lineKind: 'construction',
        amountMinor: componentMinor,
      });
    for (const group of component.groups) {
      if (!effective.visibleGroups.has(group.code)) continue;
      const accent = group.kind === 'accent';
      const line = (item: Omit<QuoteLine, 'category' | 'categoryLabel' | 'lineKind'>) =>
        lines.push({
          ...item,
          category: accent ? 'accents' : component.code,
          categoryLabel: accent ? 'Accents' : component.name,
          lineKind: group.lineKind,
        });
      const visible = group.attributes.filter((attribute) =>
        effective.visibleAttributes.has(attribute.code),
      );
      for (const attribute of visible) {
        const value = effective.selections[attribute.code];
        if (attribute.inputType !== 'choice' || value === undefined) continue;
        // A choice's own price applies whenever it is the effective value, even the default.
        const valueMinor = valueSurcharge(product, attribute, value);
        if (valueMinor > 0)
          line({
            kind: 'option',
            label: `${attribute.name}: ${attribute.values.find((item) => item.code === value)?.label ?? value}`,
            ref: valueKey(attribute.code, value),
            amountMinor: valueMinor,
          });
      }
    }
  }
  const unitMinor = lines.reduce((sum, item) => sum + item.amountMinor, 0);
  return {
    status: 'priced',
    garmentId: garment.id,
    currency,
    catalogVersion,
    lines,
    unitMinor,
    quantity: garment.quantity,
    totalMinor: unitMinor * garment.quantity,
    byCategory: byCategory(product, lines),
  };
}

/** Line totals per category: base first, then the product's parts in order, then accents. */
export function byCategory(product: RuntimeProduct, lines: readonly QuoteLine[]): CategoryTotal[] {
  const order = ['base', ...product.components.map((link) => link.componentCode), 'accents'];
  const totals = new Map<string, CategoryTotal>();
  for (const item of lines) {
    const total = totals.get(item.category) ?? {
      category: item.category,
      label: item.category === 'base' ? 'Base' : item.categoryLabel,
      amountMinor: 0,
    };
    total.amountMinor += item.amountMinor;
    totals.set(item.category, total);
  }
  return [...totals.values()].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

/** The cart quote (PRC-004): priced only when every garment is priced. */
export function quoteCart(
  index: RuntimeIndex,
  draft: Pick<DraftV2, 'garments'>,
  availability: AvailabilityMap = {},
): CartQuote {
  const garments = draft.garments.map((garment) => quoteGarment(index, garment, availability));
  const priced = garments.length > 0 && garments.every((quote) => quote.status === 'priced');
  const subtotalMinor = priced
    ? garments.reduce((sum, quote) => sum + (quote.status === 'priced' ? quote.totalMinor : 0), 0)
    : null;
  const shippingMinor = priced ? index.catalog.settings.shippingFlatMinor : null;
  return {
    status: priced ? 'priced' : 'unavailable',
    currency: index.catalog.currency,
    catalogVersion: index.catalog.version,
    garments,
    subtotalMinor,
    shippingMinor,
    totalMinor:
      subtotalMinor === null || shippingMinor === null ? null : subtotalMinor + shippingMinor,
  };
}
