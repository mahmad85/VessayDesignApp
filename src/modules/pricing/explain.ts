import { formatPrice } from '@/lib/money';
import type { RuntimeGroup, RuntimeProduct } from '../catalog/snapshot';
import { groupSurcharge, valueSurcharge, type QuoteLine } from './quote';

// Plain-language price wording (PRICING.md PRC-003, ADMIN-SCREENS §5): the
// admin explanations of how each charge applies, the customer's “+$X” and
// “Included” labels, and the double-charge warning. Pure and shared by the
// client and the server; it never computes a quote.

/** A choice's price effect: “+$10”, or “Included” for zero (never “$0”). */
export function priceEffect(amountMinor: number, currency: string) {
  return amountMinor > 0 ? `+${formatPrice(amountMinor, currency)}` : 'Included';
}

/** How a charge applies, for the admin price explanations (PRC-003). */
export function explainCharge(
  kind: QuoteLine['kind'],
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
    case 'group':
      return `Customising ${name} adds ${price} once, however many of its options move away from the product default.`;
    case 'attribute':
      return `Changing ${name} from the product default adds ${price} once.`;
    case 'option':
      return `${name} costs ${price} whenever it is chosen, even as the product default.`;
  }
}

/**
 * PRC-003: warn (without blocking) when a group and every choice in it carry
 * a surcharge — the group fee is then likely charged on top of each choice.
 */
export function doubleChargeWarning(product: RuntimeProduct, group: RuntimeGroup) {
  if (groupSurcharge(product, group) === 0) return false;
  const values = group.attributes
    .filter((attribute) => attribute.inputType === 'choice')
    .flatMap((attribute) =>
      attribute.values.map((value) => valueSurcharge(product, attribute, value.code)),
    );
  return values.length > 0 && values.every((amount) => amount > 0);
}
