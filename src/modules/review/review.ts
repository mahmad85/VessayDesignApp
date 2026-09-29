import type { DraftV2, Finding, Review } from '../configuration/types';
import type { CartQuote } from '../pricing/quote';
import { requiredDefinitionsForProducts, type MeasurementSet } from '../measurements/definitions';

// Deterministic draft check (v2: every garment in the cart). Superseded by the
// automated order check in TASK-023 (orders/check-policy.ts).

/** Garments whose design the customer has not accepted yet. */
export function unacceptedGarments(draft: DraftV2) {
  return draft.garments.filter((garment) => !garment.confirmed.includes('details'));
}

export function reviewDraft(
  draft: DraftV2,
  mode: 'automated' | 'human',
  measurementSets: readonly MeasurementSet[],
  quote: CartQuote,
): Review {
  const findings: Finding[] = [];
  if (!draft.garments.length)
    findings.push({
      id: 'cart-empty',
      severity: 'blocker',
      title: 'Choose a garment',
      description: 'Start a garment design before checking your order.',
      target: 'design',
    });
  else if (unacceptedGarments(draft).length)
    findings.push({
      id: 'design-incomplete',
      severity: 'blocker',
      title: 'Confirm your design',
      description: 'Review your fabric, occasion, weather, fit and finishing details.',
      target: 'design',
    });
  const needed = requiredDefinitionsForProducts(measurementSets).filter(
    (m) => !draft.measurements.values[m.id],
  );
  if (needed.length)
    findings.push({
      id: 'measurements-missing',
      severity: 'blocker',
      title: 'Complete your measurements',
      description: `Still needed: ${needed.map((m) => m.label).join(', ')}.`,
      target: 'measurements',
    });
  else if (!draft.measurements.confirmed)
    findings.push({
      id: 'measurements-unconfirmed',
      severity: 'blocker',
      title: 'Confirm your measurements',
      description: 'Check the values and confirm this measurement version.',
      target: 'measurements',
    });
  if (draft.measurements.source === 'customer' && Object.keys(draft.measurements.values).length)
    findings.push({
      id: 'manual-source',
      severity: 'expert',
      title: 'Measurements need verification',
      description:
        'These values were entered manually. They have not been verified by 3DLOOK or a tailor.',
      target: 'measurements',
    });
  findings.push({
    id: 'production-contract',
    severity: 'expert',
    title: 'Production checks are not enabled',
    description:
      'Supplier rules, measurement tolerances and the live catalog must be approved before an order can be accepted.',
    target: 'commercial',
  });
  // Derived from the actual quote (TASK-017): unknown is never treated as zero.
  if (quote.status !== 'priced')
    findings.push({
      id: 'quote-unavailable',
      severity: 'blocker',
      title: 'A price is not yet available',
      description: quote.garments.some(
        (item) => item.status === 'unavailable' && item.reasons.includes('material_unavailable'),
      )
        ? 'A chosen fabric is currently unavailable. Choose another fabric to see your price.'
        : 'Some of your choices have no price in the catalog yet. Payment is unavailable.',
      target: 'commercial',
    });
  return {
    id: crypto.randomUUID(),
    inputRevision: draft.revision,
    mode,
    status:
      mode === 'human'
        ? 'not_submitted'
        : findings.some((f) => f.target !== 'commercial' && f.severity === 'blocker')
          ? 'correction_required'
          : 'expert_required',
    findings,
    createdAt: new Date().toISOString(),
    checkoutEligible: false,
  };
}
