'use client';
import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatPrice } from '@/lib/money';
import type { CartQuote, GarmentQuote } from '@/modules/pricing/quote';

// The running garment price and cart total (ADMIN-SCREENS §4 S-02, PRC-004).
// Prices come from the server's quote only; an unknown price reads “Price not
// yet available” and is never shown as zero (PRC-005).

export const PRICE_UNAVAILABLE = 'Price not yet available';

function unavailableReason(quote: GarmentQuote) {
  if (quote.status !== 'unavailable') return '';
  if (quote.reasons.includes('material_unavailable'))
    return 'The chosen fabric is currently unavailable.';
  if (quote.reasons.includes('invalid_configuration'))
    return 'Some choices need your review before they can be priced.';
  return 'This combination has no price in the catalog yet.';
}

export function PriceSummary({ quote, garmentId }: { quote: CartQuote; garmentId: string }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const garment = quote.garments.find((item) => item.garmentId === garmentId);
  if (!garment) return null;
  const money = (amountMinor: number) => formatPrice(amountMinor, quote.currency);
  const categories =
    garment.status === 'priced'
      ? garment.byCategory.map((category) => ({
          ...category,
          lines: garment.lines.filter((line) => line.category === category.category),
        }))
      : [];
  return (
    <section className="price-summary" aria-label="Price">
      <div className="price-row">
        <div>
          <span className="price-label">Garment price</span>
          {garment.status === 'priced' ? (
            <strong className="price-value">
              {money(garment.unitMinor)}
              {garment.quantity > 1 && (
                <small>
                  {' '}
                  each · {money(garment.totalMinor)} for {garment.quantity}
                </small>
              )}
            </strong>
          ) : (
            <strong className="price-value unavailable">{PRICE_UNAVAILABLE}</strong>
          )}
        </div>
        <div>
          <span className="price-label">Cart total</span>
          <strong className="price-value">
            {quote.totalMinor === null ? PRICE_UNAVAILABLE : money(quote.totalMinor)}
          </strong>
        </div>
        {garment.status === 'priced' && (
          <button
            className="price-toggle"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((value) => !value)}
          >
            Price details
            <ChevronDown size={14} aria-hidden />
          </button>
        )}
      </div>
      {garment.status === 'unavailable' && (
        <p className="price-note">{unavailableReason(garment)}</p>
      )}
      {garment.status === 'priced' && open && (
        <div className="price-details" id={detailsId} role="region" aria-label="Price details">
          {categories.map((category) => (
            <dl key={category.category}>
              <div className="price-category">
                <dt>{category.label}</dt>
                <dd>{money(category.amountMinor)}</dd>
              </div>
              {category.lines.map((line) => (
                <div className="price-line" key={`${line.kind}:${line.ref}`}>
                  <dt>{line.kind === 'base' ? line.categoryLabel : line.label}</dt>
                  <dd>{money(line.amountMinor)}</dd>
                </div>
              ))}
            </dl>
          ))}
          <p className="price-note">
            {quote.shippingMinor ? `Delivery ${money(quote.shippingMinor)}. ` : ''}Prices are
            recalculated with every change.
          </p>
        </div>
      )}
    </section>
  );
}
