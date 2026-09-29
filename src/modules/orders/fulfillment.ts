import { z } from 'zod';
import { DomainError } from '../configuration/types';

export const fulfillmentStates = [
  'not_released',
  'released',
  'in_production',
  'quality_check',
  'ready_to_ship',
  'shipped',
  'delivered',
  'completed',
  'on_hold',
  'cancelled',
] as const;
export type FulfillmentState = (typeof fulfillmentStates)[number];
const progress = fulfillmentStates.slice(0, 8);
const holdable = ['released', 'in_production', 'quality_check', 'ready_to_ship'];
const terminal = ['shipped', 'delivered', 'completed', 'cancelled'];
export const dateInput = z.iso.date();
const reason = z.string().trim().min(1).max(2000);
export const versionInput = z.strictObject({ rowVersion: z.number().int().positive() });
export const assignmentInput = versionInput.extend({
  supplierId: z.uuid(),
  supplierReference: z.string().trim().max(200).nullable().optional(),
  dueDate: dateInput,
  reason: reason.optional(),
});
export const trackingInput = z.union([
  z.strictObject({
    carrier: z.string().trim().min(1).max(100),
    trackingNumber: z.string().trim().min(1).max(200),
    trackingUrl: z
      .url()
      .max(2000)
      .refine((v) => /^https?:\/\//.test(v), 'Use an http or https tracking URL.')
      .optional(),
  }),
  z.strictObject({ method: z.literal('hand_delivery'), note: z.string().trim().min(1).max(500) }),
]);
export type Tracking = z.infer<typeof trackingInput>;
export const transitionInput = versionInput.extend({
  to: z.enum(fulfillmentStates),
  reason: reason.optional(),
  tracking: trackingInput.optional(),
});
export const etaInput = versionInput.extend({ customerEtaDate: dateInput.nullable(), reason });
export const clearInput = versionInput.extend({ reason });
export const noteInput = z.strictObject({
  body: reason,
  visibility: z.enum(['internal', 'customer']),
});
export type ReleaseFacts = {
  payment: string;
  review: string;
  supplierId: string | null;
  supplierActive: boolean;
  dueDate: string | null;
};
export function releaseProblems(f: ReleaseFacts): string[] {
  return [
    f.payment !== 'succeeded' && 'Payment must be received.',
    !['not_requested', 'completed'].includes(f.review) &&
      'The requested tailor review must be complete.',
    !f.supplierId && 'Assign a manufacturer.',
    f.supplierId && !f.supplierActive && 'The assigned manufacturer must be active.',
    !f.dueDate && 'Set a supplier deadline.',
  ].filter(Boolean) as string[];
}
export function allowedTransitions(state: string, resume: string | null): FulfillmentState[] {
  const next: Record<string, FulfillmentState[]> = {
    not_released: ['released'],
    released: ['in_production'],
    in_production: ['quality_check'],
    quality_check: ['in_production', 'ready_to_ship'],
    ready_to_ship: ['shipped'],
    shipped: ['delivered'],
    delivered: ['completed'],
  };
  const result = [...(next[state] ?? [])];
  if (state === 'on_hold' && resume && holdable.includes(resume))
    result.push(resume as FulfillmentState);
  if (holdable.includes(state)) result.push('on_hold');
  if (!terminal.includes(state)) result.push('cancelled');
  return result;
}
export function assertTransition(
  state: string,
  resume: string | null,
  input: z.infer<typeof transitionInput>,
  facts: ReleaseFacts,
) {
  const allowed = allowedTransitions(state, resume);
  if (!allowed.includes(input.to))
    throw new DomainError(
      'transition_not_allowed',
      'This step is not allowed from the current state.',
      409,
      { allowed },
    );
  if (input.to === 'released' && state === 'not_released') {
    const problems = releaseProblems(facts);
    if (problems.length)
      throw new DomainError('release_blocked', problems.join(' '), 409, { problems });
  }
  if (
    (['on_hold', 'cancelled'].includes(input.to) ||
      (state === 'quality_check' && input.to === 'in_production')) &&
    !input.reason
  )
    throw new DomainError('reason_required', 'Provide a reason for this change.', 422);
  if (input.to === 'shipped' && !input.tracking)
    throw new DomainError(
      'tracking_required',
      'Enter tracking details or a hand delivery note.',
      422,
    );
  if (input.to !== 'shipped' && input.tracking)
    throw new DomainError('validation_failed', 'Tracking is entered when shipping.', 422);
}
export function assertAssignment(
  state: string,
  resume: string | null,
  supplierChanged: boolean,
  existing: boolean,
  why?: string,
) {
  const effective = state === 'on_hold' ? resume : state;
  if (
    terminal.includes(state) ||
    (supplierChanged && !['not_released', 'released'].includes(effective ?? ''))
  )
    throw new DomainError(
      'transition_not_allowed',
      'Supplier reassignment is only available before production; terminal items cannot be changed.',
      409,
    );
  if (existing && !why)
    throw new DomainError('reason_required', 'Explain the supplier or deadline change.', 422);
}
export function derivedStatus(states: string[]): FulfillmentState {
  const active = states.filter((s) => s !== 'cancelled');
  if (!active.length) return 'cancelled';
  if (active.includes('on_hold')) return 'on_hold';
  return progress.find((s) => active.includes(s)) ?? 'not_released';
}
export function dateOnly(value: unknown): string | null {
  return value == null
    ? null
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
}
export function opsToday(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export const supplierOverdue = (state: string, due: string | null, today: string) =>
  !!due && ['released', 'in_production', 'quality_check'].includes(state) && today > due;
