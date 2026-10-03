import { formatPrice } from '@/lib/money';

// Plain-language price wording (PRICING.md PRC-003, ADMIN-SCREENS §5): the
// admin explanations of how each charge applies and the customer's “+$X”
// and “Included” labels. Pure and shared by the
// client and the server; it never computes a quote.

/** A choice's price effect: “+$10”, or “Included” for zero (never “$0”). */
export function priceEffect(amountMinor: number, currency: string) {
  return amountMinor > 0 ? `+${formatPrice(amountMinor, currency)}` : 'Included';
}

/** How a charge applies, for the admin price explanations (PRC-003). */
export function explainCharge(
  kind: 'base' | 'component' | 'option',
  amountMinor: number,
  currency: string,
  name: string,
) {
  const price = formatPrice(amountMinor, currency);
  if (amountMinor === 0 && kind !== 'base') return `${name} is included.`;
  switch (kind) {
    case 'base':
      return `The base price is ${price} for ${name}.`;
    case 'component':
      return `Adding ${name} adds ${price} once per garment.`;
    case 'option':
      return `${name} costs ${price} whenever it is chosen, even as the product default.`;
  }
}
