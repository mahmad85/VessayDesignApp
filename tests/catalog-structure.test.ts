import { describe, it, expect } from 'vitest';
import { importLegacyCatalog } from '../src/modules/catalog/import-legacy';
import { indexSnapshot, type CatalogSnapshot } from '../src/modules/catalog/snapshot';
import {
  MAX_VISIBILITY_PASSES,
  defaultGarment,
  effectiveSelections,
  visibleStructure,
  type GarmentShape,
  type VisibleStructure,
} from '../src/modules/catalog/structure';
import { SYN, syntheticSnapshot } from './fixtures/catalog.synthetic';

// WP-09: customer tabs and effective selections (CATALOG-ADMIN §2.1, §4, §5.2).
// Reference import and SYNTHETIC fixture only.

const legacy = importLegacyCatalog().snapshot;
const legacyIndex = indexSnapshot(legacy);
const garmentOf = (
  snapshot: CatalogSnapshot,
  productCode: string,
  extra: Partial<GarmentShape> = {},
) => {
  const index = indexSnapshot(snapshot);
  const base = defaultGarment(index, index.products.get(productCode)!);
  return {
    index,
    garment: { ...base, ...extra, selections: { ...base.selections, ...extra.selections } },
  };
};
const tab = (structure: VisibleStructure | null, id: string) =>
  structure!.tabs.find((item) => item.id === id);
const groupCodes = (structure: VisibleStructure | null, id: string) =>
  tab(structure, id)?.groups.map((group) => group.group.code) ?? [];
const attributeCodes = (structure: VisibleStructure | null, groupCode: string) =>
  structure!.tabs
    .flatMap((item) => item.groups)
    .find((group) => group.group.code === groupCode)
    ?.attributes.map((attribute) => attribute.attribute.code) ?? [];

describe('customer tabs (CATALOG-ADMIN §2.1)', () => {
  it('orders a suit by essentials, one tab per part in link order, then accents', () => {
    const { index, garment } = garmentOf(legacy, 'suit');
    const structure = visibleStructure(index, garment)!;
    expect(structure.tabs.map((item) => [item.id, item.label])).toEqual([
      ['essentials', 'The essentials'],
      ['jacket', 'Jacket'],
      ['trousers', 'Trousers'],
      ['vest', 'Vest'],
      ['accents', 'Accents'],
    ]);
    // Suit parts keep their own tabs: nothing is flattened into Essentials.
    expect(tab(structure, 'essentials')!.groups).toEqual([]);
    expect(groupCodes(structure, 'jacket')).toEqual([
      'style.jacket.jacket_style_combined',
      'style.jacket.jacket_fit',
      'style.jacket.jacket_lapel_type_combinated',
      'style.jacket.jacket_pockets_type',
      'style.jacket.jacket_sleeve_buttons_combinated',
      'style.jacket.jacket_vent',
      'style.jacket.jacket_chest_pocket',
    ]);
    expect(groupCodes(structure, 'trousers')).toHaveLength(9);
    // Accents are sub-headed by part, in part then group order.
    const accents = tab(structure, 'accents')!.groups;
    expect(accents[0].component.code).toBe('jacket');
    expect(accents.at(-1)!.component.code).toBe('trousers');
    expect(accents.every((group) => group.group.kind === 'accent')).toBe(true);
  });

  it('shows vest groups and vest accents only once the vest is included', () => {
    const { index, garment } = garmentOf(legacy, 'suit');
    const without = visibleStructure(index, garment)!;
    expect(tab(without, 'vest')).toMatchObject({
      kind: 'component',
      include: { componentCode: 'vest', label: 'Add a vest', included: false },
      groups: [],
    });
    expect(groupCodes(without, 'accents').some((code) => code.startsWith('accents.vest.'))).toBe(
      false,
    );
    const withVest = visibleStructure(index, {
      ...garment,
      includedComponents: [...garment.includedComponents, 'vest'],
    })!;
    expect(tab(withVest, 'vest')!.include!.included).toBe(true);
    // The option-less waistcoat group (the imported toggle) has nothing to edit and is not shown.
    expect(groupCodes(withVest, 'vest')).toEqual([
      'style.vest.waistcoat_style_combined',
      'style.vest.waistcoat_lapel',
      'style.vest.waistcoat_lapel_width',
      'style.vest.waistcoat_bottom',
      'style.vest.waistcoat_chest_pocket',
      'style.vest.waistcoat_pockets',
    ]);
    expect(
      groupCodes(withVest, 'accents').filter((code) => code.startsWith('accents.vest.')),
    ).toHaveLength(5);
    // Required parts have no toggle.
    expect(tab(withVest, 'jacket')!.include).toBeNull();
  });

  it('gates detail options on a personalizado first choice', () => {
    const lining = 'accents.jacket.lining';
    const { index, garment } = garmentOf(legacy, 'suit');
    expect(attributeCodes(visibleStructure(index, garment), lining)).toEqual([
      'accents.jacket.lining.internal-lining',
    ]);
    const custom = visibleStructure(index, {
      ...garment,
      selections: {
        ...garment.selections,
        'accents.jacket.lining.internal-lining': 'personalizado',
      },
    });
    expect(attributeCodes(custom, lining)).toEqual([
      'accents.jacket.lining.internal-lining',
      'accents.jacket.lining.lining-fabrics',
    ]);
    // lining-fabrics has no default: visible, offered, but not yet answered.
    const fabrics = custom!.tabs
      .flatMap((item) => item.groups)
      .flatMap((group) => group.attributes)
      .find((attribute) => attribute.attribute.code === 'accents.jacket.lining.lining-fabrics')!;
    expect(fabrics.value).toBeUndefined();
    expect(fabrics.defaultValue).toBeNull();
    expect(fabrics.values.length).toBeGreaterThan(80);
  });

  it('gates detail options on a first choice that is not its off value', () => {
    const tie = 'accents.jacket.tie';
    const { index, garment } = garmentOf(legacy, 'suit');
    expect(attributeCodes(visibleStructure(index, garment), tie)).toEqual([
      'accents.jacket.tie.necktie',
    ]);
    const added = visibleStructure(index, {
      ...garment,
      selections: {
        ...garment.selections,
        'accents.jacket.tie.necktie': 'personalizado',
        'accents.jacket.tie.products': '761',
      },
    })!;
    expect(attributeCodes(added, tie)).toEqual([
      'accents.jacket.tie.necktie',
      'accents.jacket.tie.products',
    ]);
    const hidden = visibleStructure(index, {
      ...garment,
      selections: { ...garment.selections, 'accents.jacket.tie.products': '761' },
    })!;
    // Stored but inert while the tie is off.
    expect(attributeCodes(hidden, tie)).toEqual(['accents.jacket.tie.necktie']);
    expect(hidden.effective.selections['accents.jacket.tie.products']).toBeUndefined();
  });

  it('flattens the single part of a shirt into Essentials', () => {
    const { index, garment } = garmentOf(legacy, 'shirt');
    const structure = visibleStructure(index, garment)!;
    expect(structure.tabs.map((item) => item.id)).toEqual(['essentials']);
    expect(groupCodes(structure, 'essentials')).toEqual([
      'style.shirt.shirt_fit',
      'style.shirt.shirt_collar',
      'style.shirt.shirt_cuffs',
    ]);
  });

  it('flattens the blazer jacket into Essentials with only the choices the blazer offers', () => {
    const { index, garment } = garmentOf(legacy, 'blazer');
    const structure = visibleStructure(index, garment)!;
    // Every jacket accent is unavailable for the blazer, so there is no Accents tab.
    expect(structure.tabs.map((item) => item.id)).toEqual(['essentials']);
    expect(groupCodes(structure, 'essentials')).toEqual([
      'style.jacket.jacket_style_combined',
      'style.jacket.jacket_fit',
      'style.jacket.jacket_lapel_type_combinated',
      'style.jacket.jacket_pockets_type',
    ]);
    // The lapel width option is unavailable, and the style offers two choices.
    expect(attributeCodes(structure, 'style.jacket.jacket_lapel_type_combinated')).toEqual([
      'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type',
    ]);
    const style = structure.tabs[0].groups[0].attributes[0];
    expect(style.values.map((value) => value.code)).toEqual(['simple_1', 'simple_2']);
    expect(style.value).toBe('simple_2');
    const fit = structure.tabs[0].groups[1].attributes[0];
    expect(fit.values.map((value) => value.code)).toEqual(['1', '0', 'relaxed']);
  });

  it('applies product settings: unavailable groups hide, product defaults and choices override', () => {
    const snapshot = syntheticSnapshot();
    const { index, garment } = garmentOf(snapshot, SYN.blazer);
    const blazer = visibleStructure(index, garment)!;
    expect(blazer.tabs.map((item) => item.id)).toEqual(['essentials']);
    expect(groupCodes(blazer, 'essentials')).toEqual([
      SYN.lapelGroup,
      SYN.sleeveGroup,
      // The vent group is shown only for suits (a product condition).
    ]);
    const buttonholes = blazer.tabs[0].groups[1].attributes[0];
    expect(buttonholes.defaultValue).toBe('1');
    expect(buttonholes.value).toBe('1');
    const suit = garmentOf(snapshot, SYN.suit);
    const suitStructure = visibleStructure(suit.index, suit.garment)!;
    const suitButtonholes = suitStructure.tabs
      .flatMap((item) => item.groups)
      .find((group) => group.group.code === SYN.sleeveGroup)!.attributes[0];
    expect(suitButtonholes.defaultValue).toBe('0');
    expect(groupCodes(suitStructure, 'jacket')).toContain(SYN.ventGroup);
    expect(groupCodes(suitStructure, 'accents')).toEqual([
      SYN.liningGroup,
      SYN.initialsGroup,
      SYN.tieGroup,
    ]);
  });

  it('evaluates material conditions against the garment fabric', () => {
    const snapshot = syntheticSnapshot();
    const { index, garment } = garmentOf(snapshot, SYN.suit, {
      selections: { [SYN.lining]: 'personalizado' },
    });
    const navy = visibleStructure(index, garment)!;
    expect(attributeCodes(navy, SYN.liningGroup)).toEqual([
      SYN.lining,
      SYN.liningFabric,
      SYN.liningPiping,
    ]);
    const grey = visibleStructure(index, { ...garment, materialCode: SYN.unpriced })!;
    expect(attributeCodes(grey, SYN.liningGroup)).toEqual([SYN.lining, SYN.liningFabric]);
  });

  it('returns no structure for a product that is not in the release', () => {
    const { garment } = garmentOf(legacy, 'suit');
    expect(visibleStructure(legacyIndex, { ...garment, productCode: 'kilt' })).toBeNull();
  });
});

describe('effective selections fixed point (CATALOG-ADMIN §5.2)', () => {
  it('settles quickly for real data', () => {
    const { index, garment } = garmentOf(legacy, 'suit');
    const effective = effectiveSelections(index, garment);
    expect(effective.stable).toBe(true);
    expect(effective.passes).toBeLessThanOrEqual(3);
  });

  it('stops after the pass limit on cyclic visibility', () => {
    const snapshot = syntheticSnapshot();
    // Two options that each show only while the other is hidden never settle.
    const vent = snapshot.components[0].groups.find((group) => group.code === SYN.ventGroup)!;
    vent.visibleWhen = null;
    vent.attributes[0].visibleWhen = { attr: SYN.buttonholes, answered: false };
    const sleeve = snapshot.components[0].groups.find((group) => group.code === SYN.sleeveGroup)!;
    sleeve.attributes[0].visibleWhen = { attr: SYN.vent, answered: true };
    const { index, garment } = garmentOf(snapshot, SYN.suit);
    const effective = effectiveSelections(index, garment);
    expect(effective.stable).toBe(false);
    expect(effective.passes).toBe(MAX_VISIBILITY_PASSES);
  });
});
