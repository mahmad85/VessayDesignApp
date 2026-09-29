import { describe, it, expect } from 'vitest';
import {
  changedLeaves,
  designOutline,
  findLeaf,
} from '../src/modules/configuration/design-outline';
import type { CommandV2, DraftV2 } from '../src/modules/configuration/types';
import { REGIONS, regionForLeaf } from '../src/visualization/focus-regions';
import { sketchSpec } from '../src/visualization/sketch-spec';
import {
  activeGarment,
  add,
  draftWith,
  referenceIndex,
  renderOf,
  select,
} from './helpers/reference';

// The outline built from the catalog release (WP-15; CATALOG-ADMIN §2.1). Ported
// from the v1 outline tests: every assertion is kept, with leaf ids now group
// codes (the v1 shirt/blazer detail leaves are the shirt and jacket groups) and
// the suit fit living in the Jacket tab only. SYNTHETIC drafts only.

const index = referenceIndex();
const withVest: CommandV2 = { type: 'design', patch: { components: { vest: true } } };
const outlineOf = (draft: DraftV2) => designOutline(index, activeGarment(draft));
const suit = (...commands: CommandV2[]) => draftWith(add('suit'), ...commands);

describe('design outline shared by fields, tags and the 2D view', () => {
  it('orders a suit hierarchy by essentials, jacket, trousers, vest and accents', () => {
    const outline = outlineOf(suit());
    expect(outline.map((branch) => branch.id)).toEqual([
      'essentials',
      'jacket',
      'trousers',
      'vest',
      'accents',
    ]);
    // Suit lapel, pocket, fastening and fit live only in the jacket groups, not twice.
    expect(outline[0].leaves.map((leaf) => leaf.id)).toEqual([
      'product',
      'occasion',
      'climate',
      'fabric',
    ]);
    expect(outline[1].leaves.map((leaf) => leaf.id)).toContain('style.jacket.jacket_fit');
    expect(outline.flatMap((branch) => branch.leaves).length).toBeGreaterThan(20);
    expect(findLeaf(outline, 'style.pants.pants_chinos')).toBeUndefined();
  });

  it('only offers vest details and vest accents once a vest is added', () => {
    const before = outlineOf(suit());
    const vestBranch = before.find((b) => b.id === 'vest')!;
    expect(vestBranch.leaves).toHaveLength(1);
    expect(vestBranch.leaves[0]).toMatchObject({
      id: 'include:vest',
      kind: 'component',
      label: 'Add a vest',
      value: 'Not added',
      customized: false,
    });
    expect(before.find((b) => b.id === 'accents')!.leaves.some((l) => l.section === 'Vest')).toBe(
      false,
    );
    const after = outlineOf(suit(withVest));
    expect(after.find((b) => b.id === 'vest')!.leaves.length).toBeGreaterThan(1);
    expect(findLeaf(after, 'include:vest')).toMatchObject({ value: 'Added', customized: true });
    expect(after.find((b) => b.id === 'accents')!.leaves.some((l) => l.section === 'Vest')).toBe(
      true,
    );
  });

  it('shows gated accent details only after the accent is added', () => {
    const tie = findLeaf(outlineOf(suit()), 'accents.jacket.tie')!;
    expect(tie.group!.attributes).toHaveLength(1);
    expect(tie.value).toBe('None');
    expect(tie.customized).toBe(false);
    const added = outlineOf(
      suit(
        select({
          'accents.jacket.tie.necktie': 'personalizado',
          'accents.jacket.tie.products': '761',
        }),
      ),
    );
    const leaf = findLeaf(added, 'accents.jacket.tie')!;
    expect(leaf.value).toBe('Added · Lazio Verona Tie');
    expect(leaf.customized).toBe(true);
    expect(leaf.section).toBe('Jacket');
  });

  it('uses only the garment’s own branches for shirts and blazers', () => {
    const outline = outlineOf(draftWith(add('shirt')));
    expect(outline.map((branch) => branch.id)).toEqual(['essentials']);
    expect(outline[0].leaves.map((leaf) => leaf.id)).toEqual([
      'product',
      'occasion',
      'climate',
      'fabric',
      'style.shirt.shirt_fit',
      'style.shirt.shirt_collar',
      'style.shirt.shirt_cuffs',
    ]);
    const blazer = outlineOf(draftWith(add('blazer')));
    expect(blazer.map((branch) => branch.id)).toEqual(['essentials']);
    expect(blazer[0].leaves.map((leaf) => leaf.id)).toContain(
      'style.jacket.jacket_lapel_type_combinated',
    );
  });

  it('shows lookup labels for preferences and the fabric name', () => {
    const draft = suit({
      type: 'design',
      patch: { preferences: { occasion: 'formal_event' }, materialCode: 'forest' },
    });
    const outline = outlineOf(draft);
    expect(findLeaf(outline, 'occasion')).toMatchObject({
      value: 'Formal event',
      customized: true,
    });
    expect(findLeaf(outline, 'climate')).toMatchObject({ value: 'Not chosen', customized: false });
    expect(findLeaf(outline, 'fabric')).toMatchObject({
      value: 'Forest green',
      swatch: '#34463d',
      customized: true,
    });
  });

  it('detects the changed choice for chat suggestions and field edits alike', () => {
    const before = activeGarment(suit());
    const after = {
      ...before,
      selections: {
        ...before.selections,
        'style.pants.pants_pockets.pants-back-pocket-combine': 'B2',
      },
    };
    const [change] = changedLeaves(index, before, after);
    expect(change).toEqual({
      leafId: 'style.pants.pants_pockets',
      keys: ['style.pants.pants_pockets.pants-back-pocket-combine'],
    });
    expect(regionForLeaf(change.leafId, { index, changedKey: change.keys[0] })).toBe(
      'back-pockets',
    );
    const fabric = { ...before, materialCode: 'forest' };
    expect(changedLeaves(index, before, fabric)[0].leafId).toBe('fabric');
    const vest = { ...before, includedComponents: [...before.includedComponents, 'vest'] };
    expect(changedLeaves(index, before, vest)[0]).toEqual({
      leafId: 'include:vest',
      keys: ['vest'],
    });
    expect(changedLeaves(index, before, before)).toEqual([]);
    expect(changedLeaves(index, before, { ...before, productCode: 'shirt' })).toEqual([
      { leafId: 'product', keys: ['product'] },
    ]);
  });

  it('maps every visible suit choice to a specific drawing region', () => {
    const general = new Set(['product', 'occasion', 'climate']);
    for (const leaf of outlineOf(suit(withVest)).flatMap((branch) => branch.leaves)) {
      const region = regionForLeaf(leaf.id, { index });
      expect(REGIONS[region], leaf.id).toBeDefined();
      if (!general.has(leaf.id)) expect(region, leaf.id).not.toBe('full');
    }
  });
});

describe('2D drawing specification', () => {
  it('derives visible construction from saved choices, not labels', () => {
    const spec = sketchSpec(
      renderOf(
        suit(
          select({
            'style.jacket.jacket_style_combined.jacket-style-combined': 'crossed_6',
            'style.jacket.jacket_vent.jacket-vent': '2',
            'style.pants.pants_cuff.pants-cuff': '1',
          }),
        ),
      ),
    );
    expect(spec.jacket).toMatchObject({ style: 'crossed_6', vent: '2' });
    expect(spec.trousers.cuffs).toBe(true);
    expect(sketchSpec(renderOf(draftWith(add('shirt')))).jacket).toBeNull();
    const blazer = sketchSpec(
      renderOf(
        draftWith(
          add('blazer'),
          select({
            'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type': 'peak',
            'style.jacket.jacket_style_combined.jacket-style-combined': 'simple_1',
          }),
        ),
      ),
    );
    expect(blazer.jacket).toMatchObject({ lapelType: 'peak', style: 'simple_1' });
    expect(blazer.trousers.color).not.toBeNull();
  });
});
