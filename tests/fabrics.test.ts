import { describe, it, expect } from 'vitest';
import {
  browseFabrics,
  fabricCategory,
  fabricFacets,
  fromPrice,
  listableFabrics,
  parseFilters,
  similarFabrics,
} from '../src/modules/catalog/fabrics';
import { indexSnapshot, type RuntimeIndex } from '../src/modules/catalog/snapshot';
import { applyCommand, createDraft, type EngineContext } from '../src/modules/configuration/engine';
import { DomainError } from '../src/modules/configuration/types';
import { SYN, syntheticSnapshot } from './fixtures/catalog.synthetic';

// Customer fabric browsing (/fabrics) and starting a garment in a chosen
// fabric. SYNTHETIC catalog only.

const index = indexSnapshot({ ...syntheticSnapshot(), version: 1 }) as unknown as RuntimeIndex;
const material = (code: string) => index.materials.get(code)!;
const context: EngineContext = { current: index, releases: new Map([[1, index]]) };

describe('fabric browsing', () => {
  it('lists only fabrics some garment offers, in a category from those garments', () => {
    expect(
      listableFabrics(index)
        .map((m) => m.code)
        .sort(),
    ).toEqual([SYN.linen, SYN.navy, SYN.poplin, SYN.unpriced].sort());
    expect(fabricCategory(index, material(SYN.navy))).toBe('suiting');
    expect(fabricCategory(index, material(SYN.poplin))).toBe('shirting');
  });

  it('filters by category, colour and fibre, with counts that ignore their own filter', () => {
    expect(browseFabrics(index, { category: 'shirting' }).map((m) => m.code)).toEqual([SYN.poplin]);
    expect(browseFabrics(index, { colour: 'navy', fibre: 'wool' }).map((m) => m.code)).toEqual([
      SYN.navy,
    ]);
    const facets = fabricFacets(index, { colour: 'navy' });
    expect(facets.colour.map((c) => c.code)).toContain('beige');
    expect(facets.fibre).toEqual([{ code: 'wool', label: 'Wool', count: 1 }]);
    expect(facets.category.find((c) => c.code === 'suiting')?.count).toBe(1);
  });

  it('lists available fabrics before unavailable ones', () => {
    const order = browseFabrics(index, {}, { [SYN.linen]: 'out_of_stock' }).map((m) => m.code);
    expect(order.at(-1)).toBe(SYN.linen);
  });

  it('drops unknown or malformed filter values from the URL', () => {
    expect(
      parseFilters({ colour: 'navy', fibre: '<script>', band: ['a', 'b'], other: 'x' }),
    ).toEqual({
      colour: 'navy',
    });
  });

  it('prices from the cheapest garment the fabric fits, or not at all', () => {
    expect(fromPrice(index, material(SYN.navy))).toEqual({
      productName: index.products.get(SYN.blazer)!.name,
      amountMinor: 59900,
    });
    expect(fromPrice(index, material(SYN.unpriced))).toBeNull();
  });

  it('suggests similar fabrics without the fabric itself', () => {
    const similar = similarFabrics(index, material(SYN.navy)).map((m) => m.code);
    expect(similar).not.toContain(SYN.navy);
  });
});

describe('starting a garment in a chosen fabric', () => {
  it('uses the fabric and records it as chosen', () => {
    const draft = applyCommand(
      createDraft(),
      { type: 'add_garment', productCode: SYN.suit, materialCode: SYN.linen },
      context,
    );
    expect(draft.garments[0].materialCode).toBe(SYN.linen);
    expect(draft.garments[0].confirmed).toContain('material');
  });

  it('rejects a fabric the garment does not offer, or one that is out of stock', () => {
    expect(() =>
      applyCommand(
        createDraft(),
        { type: 'add_garment', productCode: SYN.suit, materialCode: SYN.poplin },
        context,
      ),
    ).toThrow(DomainError);
    expect(() =>
      applyCommand(
        createDraft(),
        { type: 'add_garment', productCode: SYN.suit, materialCode: SYN.linen },
        { ...context, availability: { [SYN.linen]: 'out_of_stock' } },
      ),
    ).toThrow(/unavailable/);
  });
});

describe('starting over', () => {
  it('clears garments, measurements and conversation but keeps the draft and its orders', () => {
    const started = applyCommand(
      createDraft(),
      { type: 'add_garment', productCode: SYN.suit, materialCode: SYN.linen },
      context,
    );
    const withHistory = {
      ...started,
      orders: [{ orderId: 'o-1', number: 'VS-1', submittedAt: started.updatedAt }],
      messages: [
        ...started.messages,
        { id: 'm-1', role: 'user' as const, text: 'Hello', createdAt: started.updatedAt },
      ],
    };
    const reset = applyCommand(withHistory, { type: 'start_over', confirm: true }, context);
    expect(reset.id).toBe(started.id);
    expect(reset.revision).toBe(started.revision + 1);
    expect(reset.garments).toEqual([]);
    expect(reset.activeGarmentId).toBeNull();
    expect(reset.messages).toHaveLength(1);
    expect(reset.messages[0].role).toBe('assistant');
    expect(reset.measurements.values).toEqual({});
    expect(reset.measurements.version).toBe(started.measurements.version + 1);
    expect(reset.orders).toEqual(withHistory.orders);
  });
});
