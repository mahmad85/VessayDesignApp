import { DomainError, type Draft } from '@/modules/configuration/types';
export async function beginCheckout(draft: Draft): Promise<never> {
  if (
    !draft.review ||
    draft.review.inputRevision !== draft.revision ||
    !draft.review.checkoutEligible
  )
    throw new DomainError(
      'review_required',
      'This draft is not eligible for payment. Resolve the review findings first.',
      409,
    );
  throw new DomainError(
    'checkout_unavailable',
    'A payment provider and live catalog have not been connected.',
    503,
  );
}
