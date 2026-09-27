import { describe, it, expect } from 'vitest';
import { createDraft, applyCommand } from '../src/modules/configuration/engine';
import {
  changedLeaves,
  designOutline,
  findLeaf,
  relevantSections,
} from '../src/modules/configuration/design-outline';
import { REGIONS, regionForLeaf } from '../src/visualization/focus-regions';
import { sketchSpec } from '../src/visualization/sketch-spec';

// Synthetic drafts only; no customer data.
const suit = () => createDraft();
const design = (patch: Parameters<typeof applyCommand>[1]) => applyCommand(suit(), patch).design;

describe('design outline shared by fields, tags and the 2D view', () => {
  it('orders a suit hierarchy by essentials, jacket, trousers, vest and accents', () => {
    const outline = designOutline(suit().design);
    expect(outline.map((branch) => branch.id)).toEqual([
      'essentials',
      'jacket',
      'pants',
      'vest',
      'accents',
    ]);
    // Suit lapel/pocket/fastening live only in the full jacket catalog, not twice.
    expect(outline[0].leaves.map((leaf) => leaf.id)).toEqual([
      'product',
      'occasion',
      'climate',
      'fabricId',
      'fit',
    ]);
    expect(outline.flatMap((branch) => branch.leaves).length).toBeGreaterThan(20);
    expect(findLeaf(outline, 'style.pants.pants_chinos')).toBeUndefined();
  });

  it('only offers vest details and vest accents once a vest is added', () => {
    const before = designOutline(suit().design);
    expect(before.find((b) => b.id === 'vest')!.leaves).toHaveLength(1);
    expect(before.find((b) => b.id === 'accents')!.leaves.some((l) => l.section === 'Vest')).toBe(
      false,
    );
    const after = designOutline(
      design({
        type: 'design',
        patch: { customizations: { 'style.vest.waistcoat.waistcoat': '1' } },
      }),
    );
    expect(after.find((b) => b.id === 'vest')!.leaves.length).toBeGreaterThan(1);
    expect(after.find((b) => b.id === 'accents')!.leaves.some((l) => l.section === 'Vest')).toBe(
      true,
    );
  });

  it('shows gated accent details only after the accent is added', () => {
    const outline = designOutline(suit().design);
    const tie = findLeaf(outline, 'accents.jacket.tie')!;
    expect(relevantSections(tie.group!, suit().design.customizations)).toHaveLength(1);
    expect(tie.value).toBe('None');
    const added = design({
      type: 'design',
      patch: {
        customizations: {
          'accents.jacket.tie.necktie': 'personalizado',
          'accents.jacket.tie.products': '761',
        },
      },
    });
    const leaf = findLeaf(designOutline(added), 'accents.jacket.tie')!;
    expect(leaf.value).toBe('Added · Lazio Verona Tie');
    expect(leaf.customized).toBe(true);
  });

  it('uses only the garment’s own branches for shirts and blazers', () => {
    const shirt = design({ type: 'design', patch: { product: 'shirt' } });
    const outline = designOutline(shirt);
    expect(outline.map((branch) => branch.id)).toEqual(['essentials']);
    expect(outline[0].leaves.map((leaf) => leaf.id)).toContain('cuffs');
    const blazer = design({ type: 'design', patch: { product: 'blazer' } });
    expect(designOutline(blazer)[0].leaves.map((leaf) => leaf.id)).toContain('lapel');
  });

  it('detects the changed choice for chat suggestions and field edits alike', () => {
    const start = suit();
    const next = applyCommand(start, {
      type: 'design',
      patch: {
        customizations: { 'style.pants.pants_pockets.pants-back-pocket-combine': 'B2' },
      },
    });
    const [change] = changedLeaves(start.design, next.design);
    expect(change).toEqual({
      leafId: 'style.pants.pants_pockets',
      keys: ['style.pants.pants_pockets.pants-back-pocket-combine'],
    });
    expect(regionForLeaf(change.leafId, { changedKey: change.keys[0] })).toBe('back-pockets');
    const fabric = applyCommand(start, { type: 'design', patch: { fabricId: 'forest' } });
    expect(changedLeaves(start.design, fabric.design)[0].leafId).toBe('fabricId');
    expect(changedLeaves(start.design, start.design)).toEqual([]);
  });

  it('maps every visible suit choice to a specific drawing region', () => {
    const vested = design({
      type: 'design',
      patch: { customizations: { 'style.vest.waistcoat.waistcoat': '1' } },
    });
    const general = new Set(['product', 'occasion', 'climate']);
    for (const leaf of designOutline(vested).flatMap((branch) => branch.leaves)) {
      const region = regionForLeaf(leaf.id);
      expect(REGIONS[region], leaf.id).toBeDefined();
      if (!general.has(leaf.id)) expect(region, leaf.id).not.toBe('full');
    }
  });
});

describe('2D drawing specification', () => {
  it('derives visible construction from saved choices, not labels', () => {
    const spec = sketchSpec(
      design({
        type: 'design',
        patch: {
          customizations: {
            'style.jacket.jacket_style_combined.jacket-style-combined': 'crossed_6',
            'style.jacket.jacket_vent.jacket-vent': '2',
            'style.pants.pants_cuff.pants-cuff': '1',
          },
        },
      }),
    );
    expect(spec.jacket).toMatchObject({ style: 'crossed_6', vent: '2' });
    expect(spec.trousers.cuffs).toBe(true);
    expect(sketchSpec(design({ type: 'design', patch: { product: 'shirt' } })).jacket).toBeNull();
    const blazer = sketchSpec(
      design({
        type: 'design',
        patch: { product: 'blazer', lapel: 'Peak', closure: 'One button' },
      }),
    );
    expect(blazer.jacket).toMatchObject({ lapelType: 'peak', style: 'simple_1' });
    expect(blazer.trousers.color).not.toBeNull();
  });
});
