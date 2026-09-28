import { describe, it, expect } from 'vitest';
import {
  applyGarmentPatch,
  hasConfirmedChoices,
  newGarment,
  rebaseGarment,
  validateGarment,
} from '../src/modules/catalog/garment';
import { importLegacyCatalog } from '../src/modules/catalog/import-legacy';
import { indexSnapshot, type CatalogSnapshot } from '../src/modules/catalog/snapshot';
import { effectiveSelections } from '../src/modules/catalog/structure';
import { DomainError, type Garment, type GarmentPatch } from '../src/modules/configuration/types';
import { SYN, syntheticSnapshot } from './fixtures/catalog.synthetic';

// WP-10: garment patch, validation and rebase (CATALOG-ADMIN §5.3, §7.8;
// ADMIN-BACKEND §7.1). SYNTHETIC fixture and the reference import only.

const ID = '00000000-0000-4000-8000-000000000001';
const synthetic = (mutate?: (snapshot: CatalogSnapshot) => void, version = 1) => {
  const snapshot = { ...syntheticSnapshot(), version };
  mutate?.(snapshot);
  return indexSnapshot(snapshot);
};
const suitOf = (index = synthetic()) => newGarment(index, SYN.suit, ID);
function failure(run: () => unknown) {
  try {
    run();
  } catch (e) {
    if (e instanceof DomainError) return e;
    throw e;
  }
  throw new Error('Expected a DomainError');
}
const apply = (garment: Garment, patch: GarmentPatch, index = synthetic()) =>
  applyGarmentPatch(index, garment, patch);

describe('new garments', () => {
  it('start from the product defaults at the release version', () => {
    const garment = suitOf();
    expect(garment).toMatchObject({
      id: ID,
      productCode: SYN.suit,
      templateCode: null,
      catalogVersion: 1,
      materialCode: SYN.navy,
      includedComponents: ['jacket', 'trousers'],
      preferences: { occasion: null, climate: null },
      confirmed: ['product'],
      quantity: 1,
    });
    expect(garment.selections[SYN.lapel]).toBe('standard');
    expect(hasConfirmedChoices(garment)).toBe(false);
  });

  it('copy a look’s resolved configuration as a starting point (TPL-003)', () => {
    const garment = newGarment(synthetic(), SYN.suit, ID, SYN.template);
    expect(garment).toMatchObject({
      templateCode: SYN.template,
      includedComponents: ['jacket', 'trousers', 'vest'],
      preferences: { occasion: 'wedding', climate: 'all_season' },
    });
    expect(garment.selections[SYN.lapel]).toBe('peak');
    expect(garment.selections[SYN.cuff]).toBe('0');
  });

  it('reject unknown products and looks of another product', () => {
    expect(failure(() => newGarment(synthetic(), 'kilt', ID)).code).toBe('product_unavailable');
    expect(failure(() => newGarment(synthetic(), SYN.shirt, ID, SYN.template)).code).toBe(
      'template_unavailable',
    );
  });
});

describe('applyGarmentPatch', () => {
  it('rejects unknown and unavailable choices with unavailable_option', () => {
    const suit = suitOf();
    for (const selections of <Record<string, string>[]>[
      { 'style.jacket.unknown.option': 'x' },
      { [SYN.lapel]: 'shawl' },
      { [SYN.collar]: 'spread' }, // a shirt option on a suit
    ]) {
      const error = failure(() => apply(suit, { selections }));
      expect(error).toMatchObject({ code: 'unavailable_option', status: 422 });
      expect(error.details).toMatchObject({ attributeCode: Object.keys(selections)[0] });
    }
    // A group the blazer does not offer.
    const blazer = newGarment(synthetic(), SYN.blazer, ID);
    expect(
      failure(() => apply(blazer, { selections: { [SYN.lining]: 'personalizado' } })).code,
    ).toBe('unavailable_option');
    // A choice the blazer does not offer (reference import: jacket style subset).
    const legacy = indexSnapshot(importLegacyCatalog().snapshot);
    const legacyBlazer = newGarment(legacy, 'blazer', ID);
    const style = 'style.jacket.jacket_style_combined.jacket-style-combined';
    expect(
      failure(() =>
        applyGarmentPatch(legacy, legacyBlazer, { selections: { [style]: 'crossed_6' } }),
      ).details,
    ).toEqual({ attributeCode: style, valueCode: 'crossed_6' });
    expect(
      applyGarmentPatch(legacy, legacyBlazer, { selections: { [style]: 'simple_1' } }).garment
        .selections[style],
    ).toBe('simple_1');
  });

  it('rejects fabrics not offered for the product and fabrics that are out of stock', () => {
    const suit = suitOf();
    for (const materialCode of [SYN.poplin, 'invented'])
      expect(failure(() => apply(suit, { materialCode }))).toMatchObject({
        code: 'incompatible_fabric',
        status: 422,
      });
    const index = synthetic();
    for (const availability of ['out_of_stock', 'discontinued'] as const)
      expect(
        failure(() =>
          applyGarmentPatch(
            index,
            suit,
            { materialCode: SYN.linen },
            {
              availability: { [SYN.linen]: availability },
            },
          ),
        ),
      ).toMatchObject({ code: 'material_unavailable', status: 409 });
    const low = applyGarmentPatch(
      index,
      suit,
      { materialCode: SYN.linen },
      {
        availability: { [SYN.linen]: 'low_stock' },
      },
    );
    expect(low.garment.materialCode).toBe(SYN.linen);
    expect(low.garment.confirmed).toEqual(['product', 'material']);
  });

  it('checks, transforms and clears text options', () => {
    const suit = suitOf();
    const monogram = apply(suit, { selections: { [SYN.initials]: ' ab ' } }).garment;
    expect(monogram.selections[SYN.initials]).toBe('AB');
    for (const text of ['ABCD', 'A1'])
      expect(failure(() => apply(suit, { selections: { [SYN.initials]: text } }))).toMatchObject({
        code: 'invalid_text',
        details: { attributeCode: SYN.initials },
      });
    const cleared = apply(monogram, { selections: { [SYN.initials]: '' } }).garment;
    expect(cleared.selections[SYN.initials]).toBeUndefined();
  });

  it('returns an empty impact list when nothing breaks', () => {
    const { garment, impact } = apply(suitOf(), { selections: { [SYN.lapel]: 'peak' } });
    expect(impact).toEqual([]);
    expect(garment.selections[SYN.lapel]).toBe('peak');
  });

  it('asks before a forbid rule changes another choice, then applies the resolution', () => {
    const peak = apply(suitOf(), { selections: { [SYN.lapel]: 'peak' } }).garment;
    const error = failure(() => apply(peak, { materialCode: SYN.linen }));
    expect(error).toMatchObject({ code: 'impact_confirmation_required', status: 409 });
    const impact = [
      {
        garmentId: ID,
        kind: 'selection_replaced',
        attributeCode: SYN.lapel,
        from: 'peak',
        to: 'standard',
        message:
          'Lapel style changes from Peak to Notch. Peak lapels are not offered on this linen.',
      },
    ];
    expect(error.details).toEqual({ impact });
    const confirmed = applyGarmentPatch(
      synthetic(),
      peak,
      { materialCode: SYN.linen },
      {
        confirmImpact: true,
      },
    );
    expect(confirmed.impact).toEqual(impact);
    expect(confirmed.garment.selections[SYN.lapel]).toBe('standard');
    expect(confirmed.garment.materialCode).toBe(SYN.linen);
  });

  it('asks before a require rule changes another choice', () => {
    const straight = apply(suitOf(), {
      components: { vest: true },
      selections: { [SYN.vestBottom]: 'straight' },
    }).garment;
    const { impact, garment } = applyGarmentPatch(
      synthetic(),
      straight,
      { selections: { [SYN.lapel]: 'peak' } },
      { confirmImpact: true },
    );
    expect(impact).toMatchObject([
      { kind: 'selection_replaced', attributeCode: SYN.vestBottom, from: 'straight', to: 'cut' },
    ]);
    expect(garment.selections[SYN.vestBottom]).toBe('cut');
  });

  it('rejects a changed choice that breaks a rule itself', () => {
    const linen = apply(suitOf(), { materialCode: SYN.linen }).garment;
    expect(failure(() => apply(linen, { selections: { [SYN.lapel]: 'peak' } }))).toMatchObject({
      code: 'unavailable_option',
      message: 'Peak lapels are not offered on this linen.',
    });
  });

  it('needs confirmation to change the product, then resets to its defaults', () => {
    const suit = apply(suitOf(), {
      materialCode: SYN.linen,
      preferences: { occasion: 'wedding', climate: 'warm' },
    }).garment;
    expect(suit.confirmed).toEqual(['product', 'material', 'preferences']);
    expect(failure(() => apply(suit, { productCode: SYN.shirt }))).toMatchObject({
      code: 'category_confirmation_required',
      status: 409,
    });
    const { garment } = applyGarmentPatch(
      synthetic(),
      { ...suit, quantity: 3 },
      { productCode: SYN.shirt },
      {
        confirmCategoryChange: true,
      },
    );
    expect(garment).toMatchObject({
      id: ID,
      productCode: SYN.shirt,
      materialCode: SYN.poplin,
      includedComponents: ['shirt'],
      preferences: { occasion: 'wedding', climate: 'warm' },
      confirmed: ['product', 'preferences'],
      quantity: 3,
    });
    expect(garment.selections).toEqual({ [SYN.collar]: 'spread' });
  });

  it('checks preferences against the lookups and confirms them when both are set', () => {
    const suit = suitOf();
    expect(failure(() => apply(suit, { preferences: { occasion: 'gala' } }))).toMatchObject({
      code: 'unavailable_option',
      details: { attributeCode: 'occasion', valueCode: 'gala' },
    });
    const half = apply(suit, { preferences: { occasion: 'office' } }).garment;
    expect(half.confirmed).toEqual(['product']);
    const both = apply(half, { preferences: { climate: 'cool' } }).garment;
    expect(both.preferences).toEqual({ occasion: 'office', climate: 'cool' });
    expect(both.confirmed).toEqual(['product', 'preferences']);
  });

  it('includes optional parts and refuses to drop required or unknown ones', () => {
    const vest = apply(suitOf(), { components: { vest: true } }).garment;
    expect(vest.includedComponents).toEqual(['jacket', 'trousers', 'vest']);
    expect(apply(vest, { components: { vest: false } }).garment.includedComponents).toEqual([
      'jacket',
      'trousers',
    ]);
    for (const components of <Record<string, boolean>[]>[{ jacket: false }, { shirt: true }])
      expect(failure(() => apply(vest, { components })).code).toBe('unavailable_option');
  });

  it('keeps a value for a hidden option stored but inert', () => {
    const { garment } = apply(suitOf(), { selections: { [SYN.liningFabric]: '98' } });
    expect(garment.selections[SYN.liningFabric]).toBe('98');
    expect(effectiveSelections(synthetic(), garment).selections[SYN.liningFabric]).toBeUndefined();
    const shown = apply(garment, { selections: { [SYN.lining]: 'personalizado' } }).garment;
    expect(effectiveSelections(synthetic(), shown).selections[SYN.liningFabric]).toBe('98');
  });
});

describe('validateGarment', () => {
  it('lists missing preferences, unanswered required options and rule violations', () => {
    const index = synthetic();
    const suit = suitOf(index);
    expect(validateGarment(index, suit).issues).toEqual([
      { kind: 'preference_missing', code: 'occasion' },
      { kind: 'preference_missing', code: 'climate' },
    ]);
    const custom = {
      ...suit,
      preferences: { occasion: 'office', climate: 'cool' },
      materialCode: SYN.linen,
      selections: { ...suit.selections, [SYN.lining]: 'personalizado', [SYN.lapel]: 'peak' },
    };
    expect(validateGarment(index, custom).issues).toEqual([
      { kind: 'answer_missing', attributeCode: SYN.liningFabric },
      {
        kind: 'rule_violated',
        ruleCode: 'syn-no-peak-on-linen',
        attributeCode: SYN.lapel,
        message: 'Peak lapels are not offered on this linen.',
      },
    ]);
  });

  it('checks visible values and ignores inert hidden ones', () => {
    const index = synthetic();
    const suit = {
      ...suitOf(index),
      preferences: { occasion: 'office', climate: 'cool' },
    };
    const hidden = { ...suit, selections: { ...suit.selections, [SYN.liningFabric]: 'gone' } };
    expect(validateGarment(index, hidden).issues).toEqual([]);
    const visible = { ...suit, selections: { ...suit.selections, [SYN.lapel]: 'gone' } };
    expect(validateGarment(index, visible).issues).toEqual([
      { kind: 'value_invalid', attributeCode: SYN.lapel, value: 'gone' },
    ]);
    expect(validateGarment(index, { ...suit, materialCode: SYN.poplin }).issues).toEqual([
      { kind: 'material_invalid', materialCode: SYN.poplin },
    ]);
    expect(validateGarment(index, { ...suit, productCode: 'kilt' }).issues).toEqual([
      { kind: 'product_unavailable' },
    ]);
  });

  it('requires an answer to a visible option without a default (reference vest style)', () => {
    const legacy = indexSnapshot(importLegacyCatalog().snapshot);
    const suit = newGarment(legacy, 'suit', ID);
    const withVest = {
      ...suit,
      preferences: { occasion: 'office', climate: 'cool' },
      includedComponents: ['jacket', 'trousers', 'vest'],
    };
    expect(
      validateGarment(legacy, { ...withVest, includedComponents: ['jacket', 'trousers'] }).issues,
    ).toEqual([]);
    expect(validateGarment(legacy, withVest).issues).toEqual([
      {
        kind: 'answer_missing',
        attributeCode: 'style.vest.waistcoat_style_combined.waistcoat-style-combined',
      },
    ]);
  });
});

describe('rebaseGarment', () => {
  it('keeps every valid selection and moves to the new version without impact', () => {
    const from = synthetic(undefined, 1);
    const to = synthetic(undefined, 2);
    const garment = apply(suitOf(from), { selections: { [SYN.lapel]: 'peak' } }, from).garment;
    const rebased = rebaseGarment(from, to, garment);
    expect(rebased.impact).toEqual([]);
    expect(rebased.garment).toEqual({ ...garment, catalogVersion: 2 });
  });

  it('replaces a removed choice with the default and removes one without a default', () => {
    const from = synthetic(undefined, 1);
    const garment = apply(
      suitOf(from),
      {
        selections: {
          [SYN.lapel]: 'peak',
          [SYN.lining]: 'personalizado',
          [SYN.liningFabric]: '98',
        },
      },
      from,
    ).garment;
    const to = synthetic((snapshot) => {
      const jacket = snapshot.components[0];
      const lapel = jacket.groups[0].attributes[0];
      lapel.values = lapel.values.filter((value) => value.code !== 'peak');
      const lining = jacket.groups.find((group) => group.code === SYN.liningGroup)!;
      lining.attributes[1].values = lining.attributes[1].values.filter(
        (value) => value.code !== '98',
      );
      snapshot.templates = [];
    }, 2);
    const { garment: rebased, impact } = rebaseGarment(from, to, {
      ...garment,
      confirmed: ['product', 'details'],
    });
    expect(impact).toEqual([
      {
        garmentId: ID,
        kind: 'selection_replaced',
        attributeCode: SYN.lapel,
        from: 'peak',
        to: 'standard',
        message: 'Lapel style: Peak is no longer offered and changes to Notch.',
      },
      {
        garmentId: ID,
        kind: 'selection_removed',
        attributeCode: SYN.liningFabric,
        from: '98',
        message: 'Lining fabrics: Berck is no longer offered.',
      },
    ]);
    expect(rebased.selections[SYN.lapel]).toBe('standard');
    expect(rebased.selections[SYN.liningFabric]).toBeUndefined();
    // The accepted design changed, so it must be accepted again.
    expect(rebased.confirmed).toEqual(['product']);
  });

  it('fills new options with defaults and silently drops inert values that no longer exist', () => {
    const from = synthetic(undefined, 1);
    const garment = apply(suitOf(from), { selections: { [SYN.liningFabric]: '98' } }, from).garment;
    const to = synthetic((snapshot) => {
      const lining = snapshot.components[0].groups.find((group) => group.code === SYN.liningGroup)!;
      lining.attributes[1].values = lining.attributes[1].values.filter(
        (value) => value.code !== '98',
      );
      snapshot.components[1].groups[0].attributes.push({
        ...snapshot.components[1].groups[0].attributes[0],
        code: 'style.pants.pants_cuff.cuff-width',
        name: 'Cuff width',
        sort: 2,
        defaultValueCode: '0',
      });
    }, 2);
    const { garment: rebased, impact } = rebaseGarment(from, to, garment);
    expect(impact).toEqual([]);
    expect(rebased.selections['style.pants.pants_cuff.cuff-width']).toBe('0');
    expect(rebased.selections[SYN.liningFabric]).toBeUndefined();
  });

  it('reports a fabric, part or product that is no longer offered', () => {
    const from = synthetic(undefined, 1);
    const garment = apply(
      suitOf(from),
      { materialCode: SYN.linen, components: { vest: true } },
      from,
    ).garment;
    const to = synthetic((snapshot) => {
      snapshot.materials = snapshot.materials.filter((material) => material.code !== SYN.linen);
      snapshot.rules = snapshot.rules.filter((rule) => rule.code !== 'syn-no-peak-on-linen');
      const suit = snapshot.products.find((product) => product.code === SYN.suit)!;
      suit.components = suit.components.filter((link) => link.componentCode !== 'vest');
    }, 2);
    const { garment: rebased, impact } = rebaseGarment(from, to, garment);
    expect(impact.map((item) => item.kind)).toEqual(['material_unavailable', 'component_removed']);
    expect(rebased.materialCode).toBe(SYN.navy);
    expect(rebased.includedComponents).toEqual(['jacket', 'trousers']);
    expect(rebased.confirmed).toEqual(['product']);
    const gone = synthetic((snapshot) => {
      snapshot.products = snapshot.products.filter((product) => product.code !== SYN.suit);
      snapshot.templates = [];
    }, 3);
    expect(rebaseGarment(from, gone, garment).impact).toMatchObject([
      { kind: 'product_unavailable' },
    ]);
  });

  it('proposes a resolution when the new release adds a rule the garment breaks', () => {
    const from = synthetic((snapshot) => {
      snapshot.rules = [];
    }, 1);
    const garment = apply(
      suitOf(from),
      { materialCode: SYN.linen, selections: { [SYN.lapel]: 'peak' } },
      from,
    ).garment;
    const { impact, garment: rebased } = rebaseGarment(from, synthetic(undefined, 2), garment);
    expect(impact).toMatchObject([
      { kind: 'selection_replaced', attributeCode: SYN.lapel, from: 'peak', to: 'standard' },
    ]);
    expect(rebased.selections[SYN.lapel]).toBe('standard');
  });
});
