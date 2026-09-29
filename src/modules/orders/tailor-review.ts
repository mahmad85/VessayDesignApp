import { DomainError } from '../configuration/types';
export type ReviewStatus =
  'awaiting_payment' | 'pending' | 'in_review' | 'awaiting_customer' | 'completed' | 'cancelled';
const transitions: Record<ReviewStatus, ReviewStatus[]> = {
  awaiting_payment: ['pending', 'cancelled'],
  pending: ['in_review', 'cancelled'],
  in_review: ['completed', 'awaiting_customer', 'cancelled'],
  awaiting_customer: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
export function reviewTransition(from: ReviewStatus, to: ReviewStatus) {
  if (!transitions[from]?.includes(to))
    throw new DomainError(
      'transition_not_allowed',
      'This tailor review no longer allows that action.',
      409,
    );
}
export const isOverdue = (status: string, dueAt: string | Date | null, now = Date.now()) =>
  ['pending', 'in_review'].includes(status) && !!dueAt && new Date(dueAt).getTime() < now;
