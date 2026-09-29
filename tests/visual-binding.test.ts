import { describe, it, expect } from 'vitest';
import { indexSnapshot } from '../src/modules/catalog/snapshot';
import { newGarment } from '../src/modules/catalog/garment';
import { renderValues } from '../src/visualization/binding';
import { sketchSpec } from '../src/visualization/sketch-spec';
import { regionForLeaf } from '../src/visualization/focus-regions';
import { shownIn3D } from '../src/visualization/garments/coverage';
import { SYN, syntheticSnapshot } from './fixtures/catalog.synthetic';
import {
  activeGarment,
  add,
  draftWith,
  referenceIndex,
  renderOf,
  select,
} from './helpers/reference';

// WP-14: renderers read render values bound through the registry
// (CATALOG-ADMIN §6, CAT-014, VIS-002). Reference import and SYNTHETIC data.

const ID = '00000000-0000-4000-8000-00000000000a';

describe('render values', () => {
  it('bind visible choices to slot tokens, chosen images and included parts', () => {
    const draft = draftWith(
      add('suit'),
      select({
        'accents.jacket.lining.internal-lining': 'personalizado',
        'accents.jacket.lining.lining-fabrics': '98',
      }),
      { type: 'design', patch: { components: { vest: true }, materialCode: 'blue-check' } },
      { type: 'appearance', skinTone: 'tan' },
    );
    const render = renderOf(draft);
    expect(render).toMatchObject({
      visualModel: 'suit',
      skinTone: 'tan',
      material: { color: '#4a6178', pattern: 'check' },
      parts: ['jacket', 'trousers', 'vest'],
    });
    expect(render.tokens).toMatchObject({
      'jacket.lapelType': 'standard',
      'jacket.lining': 'personalizado',
      'jacket.liningFabric': '98',
      'vest.bottom': 'cut',
    });
    expect(render.images['jacket.liningFabric']).toMatch(/^\/reference-assets\/hockerty-suit\//);
    expect(render.notIllustrated).toEqual([]);
  });

  it('never draw a hidden (inert) choice', () => {
    const render = renderOf(
      draftWith(add('suit'), select({ 'accents.jacket.tie.products': '761' })),
    );
    expect(render.tokens['tie.on']).toBe('without');
    expect(render.tokens['tie.product']).toBeUndefined();
    expect(sketchSpec(render).tie).toEqual({ on: false, asset: undefined });
  });

  it('draw only the options a product offers', () => {
    const render = renderOf(draftWith(add('blazer')));
    expect(Object.keys(render.tokens).sort()).toEqual([
      'fit',
      'jacket.lapelType',
      'jacket.pockets',
      'jacket.style',
    ]);
    expect(render.parts).toEqual(['jacket']);
    expect(sketchSpec(render).jacket).toMatchObject({ vent: '2', lapelWidth: 'standard' });
  });

  it('flag a visible bound choice without a token as not illustrated', () => {
    const snapshot = syntheticSnapshot();
    snapshot.components[0].groups[0].attributes[0].values[1].visualToken = null;
    const index = indexSnapshot(snapshot);
    const garment = newGarment(index, SYN.suit, ID);
    const peak = { ...garment, selections: { ...garment.selections, [SYN.lapel]: 'peak' } };
    const render = renderValues(index, peak, 'warm');
    expect(render.notIllustrated).toEqual([SYN.lapel]);
    expect(render.tokens['jacket.lapelType']).toBeUndefined();
    // The drawing keeps its own default; the customer sees the choice text instead.
    expect(sketchSpec(render).jacket!.lapelType).toBe('standard');
    expect(renderValues(index, garment, 'warm').notIllustrated).toEqual([]);
  });

  it('fall back to the drawing defaults for a product the release does not have', () => {
    const index = referenceIndex();
    const garment = activeGarment(draftWith(add('suit')));
    const render = renderValues(index, { ...garment, productCode: 'kilt' }, 'warm');
    expect(render).toMatchObject({ visualModel: 'suit', parts: [], tokens: {} });
  });
});

describe('focus regions and 3D coverage from the catalog', () => {
  it('read a group’s focus region and a part toggle’s drawing area', () => {
    const snapshot = syntheticSnapshot();
    snapshot.components[0].groups[0].focusRegion = 'chest';
    const index = indexSnapshot(snapshot);
    expect(regionForLeaf(SYN.lapelGroup, { index })).toBe('chest');
    expect(regionForLeaf(SYN.liningGroup, { index })).toBe('inside');
    expect(regionForLeaf('include:vest', { index })).toBe('vest');
    expect(regionForLeaf('include:trousers', { index })).toBe('legs');
    expect(regionForLeaf('unknown.group', { index })).toBe('full');
    expect(regionForLeaf('fabric', { index, product: 'shirt' })).toBe('full');
    expect(regionForLeaf('fabric', { index })).toBe('torso');
  });

  it('derive 3D coverage from the slots of a group’s options', () => {
    const index = indexSnapshot(syntheticSnapshot());
    expect(shownIn3D(SYN.lapelGroup, index)).toBe(true);
    // Lining is bound to a 2D-only slot; the monogram group has no slot at all.
    expect(shownIn3D(SYN.liningGroup, index)).toBe(false);
    expect(shownIn3D(SYN.initialsGroup, index)).toBe(false);
    expect(shownIn3D('include:vest', index)).toBe(true);
    expect(shownIn3D('product', index)).toBe(true);
    expect(shownIn3D('occasion', index)).toBe(false);
  });
});
