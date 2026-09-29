import { describe, it, expect } from 'vitest';
import { indexSnapshot } from '../src/modules/catalog/snapshot';
import { newGarment } from '../src/modules/catalog/garment';
import {
  basePrice,
  quoteCart,
  quoteGarment,
  type GarmentQuote,
} from '../src/modules/pricing/quote';
import { doubleChargeWarning, explainCharge, priceEffect } from '../src/modules/pricing/explain';
import { formatPrice } from '../src/lib/money';
import type { Garment } from '../src/modules/configuration/types';
import {
  PRICING_EXAMPLES,
  SYN,
  syntheticSnapshot,
  type SyntheticOptions,
} from './fixtures/catalog.synthetic';
import { activeGarment, add, draftWith, referenceIndex } from './helpers/reference';

// WP-17: the pricing engine (PRICING.md PRC-002 – PRC-005). Every amount is
// SYNTHETIC, from the PRICING.md worked examples.

const ID = '00000000-0000-4000-8000-0000000000e1';
const indexFor = (options: SyntheticOptions = {}) => indexSnapshot(syntheticSnapshot(options));
const garment = (extra: Partial<Garment> = {}, productCode: string = SYN.suit): Garment => ({
  ...newGarment(indexFor(), productCode, ID),
  ...extra,
});
const priced = (quote: GarmentQuote) => {
  if (quote.status !== 'priced') throw new Error(`Unpriced: ${quote.reasons.join(', ')}`);
  return quote;
};
const amounts = (quote: GarmentQuote) =>
  priced(quote).lines.map((line) => [line.kind, line.ref, line.amountMinor]);

describe('PRICING.md worked examples (SYNTHETIC)', () => {
  for (const example of PRICING_EXAMPLES)
    it(`${example.id}`, () => {
      const quote = quoteGarment(
        indexFor(example.options),
        garment({
          materialCode: example.materialCode,
          includedComponents: example.includedComponents,
          selections: example.selections,
          quantity: example.quantity,
        }),
      );
      if (example.expected.status === 'unavailable') {
        expect(quote).toMatchObject({ status: 'unavailable', reasons: example.expected.reasons });
        return;
      }
      expect(quote).toMatchObject({
        status: 'priced',
        currency: 'USD',
        unitMinor: example.expected.unitMinor,
        quantity: example.quantity,
        totalMinor: example.expected.totalMinor,
      });
      if (example.expected.byCategory)
        expect(
          Object.fromEntries(priced(quote).byCategory.map((c) => [c.category, c.amountMinor])),
        ).toEqual(example.expected.byCategory);
    });

  it('E3 lines in outline order, grouped by category', () => {
    const e3 = PRICING_EXAMPLES.find((example) => example.id === 'E3')!;
    const quote = priced(
      quoteGarment(
        indexFor(),
        garment({
          materialCode: e3.materialCode,
          includedComponents: e3.includedComponents,
          selections: e3.selections,
        }),
      ),
    );
    expect(amounts(quote)).toEqual([
      ['base', SYN.suit, 79900],
      ['option', `${SYN.buttonholes}::1`, 1000],
      ['group', SYN.liningGroup, 1600],
      ['option', `${SYN.liningFabric}::98`, 900],
      ['component', 'vest', 10000],
    ]);
    expect(quote.byCategory).toEqual([
      { category: 'base', label: 'Base', amountMinor: 79900 },
      { category: 'jacket', label: 'Jacket', amountMinor: 1000 },
      { category: 'vest', label: 'Vest', amountMinor: 10000 },
      { category: 'accents', label: 'Accents', amountMinor: 2500 },
    ]);
    expect(quote.lines[0]).toMatchObject({ categoryLabel: 'Suit · Band B' });
    expect(quote.lines.find((line) => line.kind === 'group')).toMatchObject({
      category: 'accents',
      label: 'Lining (custom)',
      lineKind: 'construction',
    });
  });
});

describe('charges (PRC-002, PRC-003)', () => {
  it('prefers a fabric price override for the product over the band price', () => {
    const index = indexFor({ navyOverrideForSuit: 129900 });
    expect(basePrice(index, index.products.get(SYN.suit)!, SYN.navy)).toEqual({
      amountMinor: 129900,
      band: null,
    });
    expect(basePrice(indexFor(), indexFor().products.get(SYN.suit)!, SYN.navy)).toEqual({
      amountMinor: 79900,
      band: 'B',
    });
    const quote = priced(quoteGarment(index, garment()));
    expect(quote.lines[0]).toMatchObject({
      amountMinor: 129900,
      categoryLabel: 'Suit · SYNTHETIC midnight navy',
    });
  });

  it('applies product surcharge overrides, and charges a default choice its own price', () => {
    // The blazer's default buttonholes choice costs 500 there (1000 elsewhere).
    const blazer = priced(quoteGarment(indexFor(), garment({}, SYN.blazer)));
    expect(amounts(blazer)).toEqual([
      ['base', SYN.blazer, 59900],
      ['option', `${SYN.buttonholes}::1`, 500],
    ]);
    expect(blazer.unitMinor).toBe(60400);
  });

  it('never charges hidden (inert) choices', () => {
    const quote = priced(
      quoteGarment(
        indexFor(),
        garment({ selections: { ...garment().selections, [SYN.liningFabric]: '98' } }),
      ),
    );
    expect(quote.unitMinor).toBe(79900);
  });

  it('charges a group once however many of its options are active', () => {
    const selections = {
      ...garment().selections,
      [SYN.lining]: 'personalizado',
      [SYN.liningFabric]: '116',
      [SYN.liningPiping]: 'contrast',
    };
    const quote = priced(quoteGarment(indexFor(), garment({ selections })));
    expect(amounts(quote)).toEqual([
      ['base', SYN.suit, 79900],
      ['group', SYN.liningGroup, 1600],
    ]);
  });

  it('activates a text option only when it has text', () => {
    const empty = priced(quoteGarment(indexFor(), garment()));
    expect(empty.unitMinor).toBe(79900);
    const initials = priced(
      quoteGarment(
        indexFor(),
        garment({ selections: { ...garment().selections, [SYN.initials]: 'AB' } }),
      ),
    );
    expect(amounts(initials)).toEqual([
      ['base', SYN.suit, 79900],
      ['attribute', SYN.initials, 1000],
    ]);
    expect(initials.lines[1]).toMatchObject({ category: 'accents', label: 'Initials' });
  });

  it('multiplies the unit price by the quantity', () => {
    const quote = priced(quoteGarment(indexFor(), garment({ quantity: 3 })));
    expect(quote).toMatchObject({ unitMinor: 79900, quantity: 3, totalMinor: 239700 });
  });
});

describe('unknown is not zero (PRC-005)', () => {
  it('reports every reason the garment cannot be priced', () => {
    expect(quoteGarment(indexFor(), garment({ materialCode: SYN.unpriced }))).toMatchObject({
      status: 'unavailable',
      reasons: ['base_price_missing'],
    });
    expect(quoteGarment(indexFor(), garment(), { [SYN.navy]: 'out_of_stock' })).toMatchObject({
      status: 'unavailable',
      reasons: ['material_unavailable'],
    });
    const broken = garment({
      materialCode: SYN.unpriced,
      selections: { ...garment().selections, [SYN.lapel]: 'shawl' },
    });
    expect(quoteGarment(indexFor(), broken, { [SYN.unpriced]: 'discontinued' })).toMatchObject({
      status: 'unavailable',
      reasons: ['base_price_missing', 'material_unavailable', 'invalid_configuration'],
    });
    expect(quoteGarment(indexFor(), garment({ productCode: 'kilt' }))).toMatchObject({
      status: 'unavailable',
      reasons: ['invalid_configuration'],
    });
    // Low stock and unknown availability still price.
    expect(quoteGarment(indexFor(), garment(), { [SYN.navy]: 'low_stock' }).status).toBe('priced');
  });

  it('prices nothing in the imported reference catalog', () => {
    const quote = quoteGarment(referenceIndex(), activeGarment(draftWith(add('suit'))));
    expect(quote).toMatchObject({ status: 'unavailable', reasons: ['base_price_missing'] });
  });
});

describe('cart quote', () => {
  it('sums priced garments and adds the flat delivery fee', () => {
    const snapshot = syntheticSnapshot();
    snapshot.settings.shippingFlatMinor = 1500;
    const index = indexSnapshot(snapshot);
    const suit = garment({ quantity: 2 });
    const shirt = { ...newGarment(index, SYN.shirt, '00000000-0000-4000-8000-0000000000e2') };
    const cart = quoteCart(index, { garments: [suit, shirt] });
    expect(cart).toMatchObject({
      status: 'priced',
      currency: 'USD',
      subtotalMinor: 79900 * 2 + 12900,
      shippingMinor: 1500,
      totalMinor: 79900 * 2 + 12900 + 1500,
    });
    expect(cart.garments.map((quote) => quote.garmentId)).toEqual([suit.id, shirt.id]);
  });

  it('is unavailable, never zero, when any garment is unpriced or the cart is empty', () => {
    const cart = quoteCart(indexFor(), {
      garments: [
        garment(),
        garment({ id: '00000000-0000-4000-8000-0000000000e3', materialCode: SYN.unpriced }),
      ],
    });
    expect(cart).toMatchObject({
      status: 'unavailable',
      subtotalMinor: null,
      shippingMinor: null,
      totalMinor: null,
    });
    expect(cart.garments[0].status).toBe('priced');
    expect(quoteCart(indexFor(), { garments: [] })).toMatchObject({
      status: 'unavailable',
      totalMinor: null,
    });
  });
});

describe('price wording (PRC-003, ADMIN-SCREENS §5)', () => {
  it('shows effects as +$X or Included, never $0', () => {
    expect(priceEffect(1000, 'USD')).toBe('+$10');
    expect(priceEffect(950, 'USD')).toBe('+$9.50');
    expect(priceEffect(0, 'USD')).toBe('Included');
    expect(formatPrice(93400, 'USD')).toBe('$934');
  });

  it('explains how each charge applies', () => {
    expect(explainCharge('group', 1600, 'USD', 'Lining')).toBe(
      'Customising Lining adds $16 once, however many of its options move away from the product default.',
    );
    expect(explainCharge('option', 1000, 'USD', 'Working buttonholes')).toContain(
      'even as the product default',
    );
    expect(explainCharge('component', 10000, 'USD', 'the vest')).toBe(
      'Adding the vest adds $100 once per garment.',
    );
    expect(explainCharge('attribute', 0, 'USD', 'Lapel style')).toBe('Lapel style is included.');
  });

  it('warns when a group and every one of its choices carry a surcharge', () => {
    const snapshot = syntheticSnapshot();
    const index = indexSnapshot(snapshot);
    const suit = index.products.get(SYN.suit)!;
    const lining = index.groups.get(SYN.liningGroup)!.group;
    expect(doubleChargeWarning(suit, lining)).toBe(false);
    for (const attribute of snapshot.components[0].groups.find((g) => g.code === SYN.liningGroup)!
      .attributes)
      for (const value of attribute.values) value.surchargeMinor = 100;
    const charged = indexSnapshot(snapshot);
    expect(
      doubleChargeWarning(
        charged.products.get(SYN.suit)!,
        charged.groups.get(SYN.liningGroup)!.group,
      ),
    ).toBe(true);
  });
});
