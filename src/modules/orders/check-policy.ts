import type { DraftV2, OrderCheck } from '../configuration/types';
import { measurementSets, type EngineContext } from '../configuration/engine';
import { isSelectable, validateGarment } from '../catalog/garment';
import { requiredDefinitionsForProducts } from '../measurements/definitions';
import { quoteCart } from '../pricing/quote';

export const CHECK_POLICY = 'check-policy-v1' as const;
export function orderFindings(
  draft: DraftV2,
  context: EngineContext,
  production = process.env.NODE_ENV === 'production',
): OrderCheck['findings'] {
  const findings: OrderCheck['findings'] = [];
  const add = (
    id: string,
    target: 'design' | 'measurements' | 'commercial',
    title: string,
    description: string,
    extra: Partial<OrderCheck['findings'][number]> = {},
  ) =>
    findings.push({
      id,
      target,
      title,
      description,
      severity: 'blocker',
      source: 'rules',
      ...extra,
    });
  if (!draft.garments.length)
    add('cart_empty', 'design', 'Choose a garment', 'Add a garment before checking your order.');
  for (const garment of draft.garments) {
    const name = context.current.products.get(garment.productCode)?.name ?? garment.productCode;
    const extra = { garmentId: garment.id };
    const { issues } = validateGarment(context.current, garment);
    if (issues.length)
      add(
        `design_invalid:${garment.id}`,
        'design',
        `Complete your ${name}`,
        'Review the missing or incompatible choices.',
        extra,
      );
    if (
      !['product', 'material', 'preferences', 'details'].every((key) =>
        garment.confirmed.includes(key as (typeof garment.confirmed)[number]),
      )
    )
      add(
        `design_unaccepted:${garment.id}`,
        'design',
        `Confirm your ${name}`,
        'Review and confirm this garment’s design.',
        extra,
      );
    if (garment.catalogVersion !== context.current.catalog.version)
      add(
        `catalog_stale:${garment.id}`,
        'design',
        'Review the catalog update',
        'This garment uses an earlier catalog. Review its changes before ordering.',
        extra,
      );
    const availability = context.availability?.[garment.materialCode] ?? 'unknown';
    if (!isSelectable(availability))
      add(
        `material_unavailable:${garment.id}`,
        'design',
        'Choose an available fabric',
        `${name} uses a fabric that is no longer available.`,
        extra,
      );
    else if (availability === 'unknown' || availability === 'low_stock')
      add(
        `material_advice:${garment.id}`,
        'commercial',
        availability === 'unknown' ? 'Availability not confirmed' : 'Limited fabric stock',
        'Fabric availability will be checked again before payment.',
        { ...extra, severity: 'advice' },
      );
  }
  for (const m of requiredDefinitionsForProducts(measurementSets(context, draft))) {
    const value = draft.measurements.values[m.id];
    if (!Number.isFinite(value) || value <= 0 || value > 3000)
      add(
        `measurement:${m.id}`,
        'measurements',
        `Enter ${m.label}`,
        'Provide a value before confirming your measurements.',
        { field: m.id },
      );
  }
  if (!draft.measurements.confirmed)
    add(
      'measurements_unconfirmed',
      'measurements',
      'Confirm your measurements',
      'Check and confirm this measurement version.',
    );
  if (draft.measurements.source === 'customer')
    add(
      'manual_measurements',
      'measurements',
      'Your measurements',
      'You entered these measurements yourself. We will make your garments to them. Add a tailor review if you would like an expert to check them.',
      { severity: 'advice' },
    );
  if (quoteCart(context.current, draft, context.availability).status !== 'priced')
    add(
      'quote_unavailable',
      'commercial',
      'Price not yet available',
      'Every garment needs a price before it can be ordered.',
    );
  if (production && context.current.catalog.referenceOnly)
    add(
      'catalog_not_orderable',
      'commercial',
      'Reference catalog',
      'Reference data cannot be ordered in production.',
    );
  return findings;
}
