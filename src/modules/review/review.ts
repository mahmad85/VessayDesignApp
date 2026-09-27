import type { Draft, Finding, Review } from '../configuration/types';
import { definitionsFor } from '../measurements/definitions';
export function missingDesign(d: Draft['design']) {
  return ['product', 'fabricId', 'occasion', 'climate', 'fit', 'details'].filter(
    (k) => !d.confirmed.includes(k),
  );
}
export function reviewDraft(draft: Draft, mode: 'automated' | 'human'): Review {
  const findings: Finding[] = [];
  const missing = missingDesign(draft.design);
  if (missing.length)
    findings.push({
      id: 'design-incomplete',
      severity: 'blocker',
      title: 'Confirm your design',
      description: 'Review your fabric, occasion, weather, fit and finishing details.',
      target: 'design',
    });
  const needed = definitionsFor(draft.design.product).filter(
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
  findings.push({
    id: 'quote-unavailable',
    severity: 'blocker',
    title: 'A live quote is required',
    description: 'This development catalog has no commercial prices. Payment is unavailable.',
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
