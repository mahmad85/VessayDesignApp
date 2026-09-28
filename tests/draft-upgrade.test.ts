import { describe, it, expect } from 'vitest';
import fixture from './fixtures/drafts-v1.synthetic.json';
import { importLegacyCatalog } from '../src/modules/catalog/import-legacy';
import { indexSnapshot } from '../src/modules/catalog/snapshot';
import { validateGarment } from '../src/modules/catalog/garment';
import {
  garmentPatchFromLegacy,
  isDraftV2,
  upgradeDraft,
} from '../src/modules/configuration/upgrade';
import type { DraftV1 } from '../src/modules/configuration/types';

// WP-11: the v1 → v2 draft upgrade, one block per ADMIN-BACKEND §7.2 row.
// The v1 drafts are SYNTHETIC, recorded from the pre-D-019 engine.

const V1 = fixture.drafts as unknown as Record<keyof typeof fixture.drafts, DraftV1>;
const all = Object.entries(V1) as [string, DraftV1][];
const up = (name: keyof typeof V1) => upgradeDraft(structuredClone(V1[name]));
const garment = (name: keyof typeof V1) => up(name).garments[0];
const K = {
  jacketFit: 'style.jacket.jacket_fit.jacket-fit',
  style: 'style.jacket.jacket_style_combined.jacket-style-combined',
  lapel: 'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type',
  pockets: 'style.jacket.jacket_pockets_type.jacket-pockets-type',
  vest: 'style.vest.waistcoat.waistcoat',
  shirtFit: 'style.shirt.shirt_fit.shirt-fit',
  collar: 'style.shirt.shirt_collar.shirt-collar',
  cuffs: 'style.shirt.shirt_cuffs.shirt-cuffs',
};

describe('v1 → v2 draft upgrade (ADMIN-BACKEND §7.2)', () => {
  it('design.product: one garment whose id is the draft id, active, release 1, quantity 1', () => {
    for (const [name, v1] of all) {
      const v2 = upgradeDraft(structuredClone(v1));
      expect(v2.garments, name).toHaveLength(1);
      expect(v2.garments[0], name).toMatchObject({
        id: v1.id,
        productCode: v1.design.product,
        templateCode: null,
        catalogVersion: 1,
        quantity: 1,
      });
      expect(v2.activeGarmentId, name).toBe(v1.id);
    }
  });

  it('design.fabricId: the material code is the same code', () => {
    for (const [name, v1] of all)
      expect(upgradeDraft(structuredClone(v1)).garments[0].materialCode, name).toBe(
        v1.design.fabricId,
      );
  });

  it('suit customizations: selections without the waistcoat option, the vest as a part', () => {
    const plain = garment('suitDefault');
    const { [K.vest]: _vest, ...expected } = V1.suitDefault.design.customizations;
    expect(_vest).toBe('0');
    expect(plain.selections).toEqual(expected);
    expect(plain.includedComponents).toEqual(['jacket', 'trousers']);
    const vested = garment('suitEdited');
    expect(vested.includedComponents).toEqual(['jacket', 'trousers', 'vest']);
    expect(vested.selections[K.vest]).toBeUndefined();
    expect(vested.selections).toMatchObject({
      [K.lapel]: 'peak',
      'style.pants.pants_cuff.pants-cuff': '1',
      'accents.jacket.lining.internal-lining': 'personalizado',
      'accents.jacket.lining.lining-fabrics': '98',
    });
  });

  it('suit jacket fit: the stored fit is kept, and a Relaxed fit becomes relaxed', () => {
    expect(garment('suitDefault').selections[K.jacketFit]).toBe('1');
    expect(garment('suitEdited').selections[K.jacketFit]).toBe('0');
    // v1 never wrote Relaxed into the customizations; the customer's choice is preserved.
    expect(V1.suitRelaxed.design.customizations[K.jacketFit]).toBe('1');
    expect(garment('suitRelaxed').selections[K.jacketFit]).toBe('relaxed');
    const { [K.jacketFit]: _fit, ...noFit } = V1.suitEdited.design.customizations;
    expect(_fit).toBe('0');
    const mapped = upgradeDraft({
      ...structuredClone(V1.suitEdited),
      design: { ...V1.suitEdited.design, customizations: noFit },
    });
    expect(mapped.garments[0].selections[K.jacketFit]).toBe('0');
  });

  it('blazer: the jacket part with fit, lapel, pockets and style from the legacy fields', () => {
    expect(garment('blazerDefault')).toMatchObject({
      includedComponents: ['jacket'],
      selections: {
        [K.jacketFit]: '1',
        [K.lapel]: 'standard',
        [K.pockets]: '2b',
        [K.style]: 'simple_2',
      },
    });
    expect(garment('blazerEdited').selections).toEqual({
      [K.jacketFit]: '0',
      [K.lapel]: 'peak',
      [K.pockets]: '2',
      [K.style]: 'simple_1',
    });
  });

  it('shirt: the shirt part with fit, collar and cuffs', () => {
    expect(garment('shirtDefault')).toMatchObject({
      includedComponents: ['shirt'],
      selections: { [K.shirtFit]: 'tailored', [K.collar]: 'spread', [K.cuffs]: 'button' },
    });
    expect(garment('shirtEdited').selections).toEqual({
      [K.shirtFit]: 'relaxed',
      [K.collar]: 'point',
      [K.cuffs]: 'french',
    });
  });

  it('occasion and climate labels: lookup codes, and empty becomes null', () => {
    expect(garment('suitDefault').preferences).toEqual({ occasion: null, climate: null });
    expect(garment('suitEdited').preferences).toEqual({
      occasion: 'wedding',
      climate: 'all_season',
    });
    expect(garment('suitRelaxed').preferences).toEqual({ occasion: 'office', climate: null });
    expect(garment('shirtEdited').preferences).toEqual({ occasion: 'everyday', climate: 'warm' });
    expect(garment('blazerEdited').preferences).toEqual({
      occasion: 'formal_event',
      climate: 'cool',
    });
  });

  it('confirmed: details confirms all four keys; otherwise product, material and preferences', () => {
    const all4 = ['product', 'material', 'preferences', 'details'];
    expect(garment('suitEdited').confirmed).toEqual(all4);
    expect(garment('blazerEdited').confirmed).toEqual(all4);
    expect(garment('shirtEdited').confirmed).toEqual(['product', 'material', 'preferences']);
    expect(garment('shirtDefault').confirmed).toEqual(['product']);
    // Fit and a lone occasion have no v2 key.
    expect(garment('suitRelaxed').confirmed).toEqual([]);
    expect(garment('suitDefault').confirmed).toEqual([]);
  });

  it('skinTone moves to the draft', () => {
    expect(up('shirtEdited').skinTone).toBe('deep');
    expect(up('suitDefault').skinTone).toBe('warm');
  });

  it('chat suggestions become garment patches for the draft garment, or are dropped', () => {
    const v2 = up('withSuggestions');
    const suggestions = v2.messages.map((message) => message.suggestion);
    expect(suggestions).toEqual([
      undefined,
      {
        garmentId: V1.withSuggestions.id,
        patch: {
          productCode: 'shirt',
          materialCode: 'ivory',
          preferences: { occasion: 'wedding', climate: 'warm' },
        },
      },
      { garmentId: V1.withSuggestions.id, patch: { materialCode: 'forest' } },
      // A skin-tone-only suggestion has nothing for a garment.
      undefined,
    ]);
    expect(v2.messages[3]).not.toHaveProperty('suggestion');
    expect(v2.messages.map((message) => message.basisRevision)).toEqual([undefined, 1, 2, 3]);
  });

  it('adds schemaVersion 2 and an empty order list; keeps the revision, measurements and review', () => {
    const v1 = V1.measured;
    const v2 = up('measured');
    expect(v2).toMatchObject({
      schemaVersion: 2,
      id: v1.id,
      revision: v1.revision,
      createdAt: v1.createdAt,
      updatedAt: v1.updatedAt,
      orders: [],
      measurements: v1.measurements,
      review: v1.review,
    });
    expect(v2).not.toHaveProperty('design');
  });

  it('is deterministic and idempotent on v2', () => {
    for (const [name, v1] of all) {
      const once = upgradeDraft(structuredClone(v1));
      expect(upgradeDraft(structuredClone(v1)), name).toEqual(once);
      expect(isDraftV2(once)).toBe(true);
      expect(isDraftV2(v1)).toBe(false);
      expect(upgradeDraft(structuredClone(once)), name).toEqual(once);
    }
  });

  it('yields codes the imported release recognises for every garment', () => {
    const index = indexSnapshot({ ...importLegacyCatalog().snapshot, version: 1 });
    for (const [name, v1] of all) {
      const { issues } = validateGarment(index, upgradeDraft(structuredClone(v1)).garments[0]);
      const unexpected = issues.filter(
        (issue) => issue.kind !== 'preference_missing' && issue.kind !== 'answer_missing',
      );
      expect(unexpected, name).toEqual([]);
    }
  });
});

describe('legacy design patches (chat suggestions)', () => {
  it('map fit and details to the options of the target product', () => {
    expect(
      garmentPatchFromLegacy({ fit: 'Relaxed', lapel: 'Peak', collar: 'Point' }, 'suit'),
    ).toEqual({
      selections: { [K.jacketFit]: 'relaxed', [K.lapel]: 'peak' },
    });
    expect(
      garmentPatchFromLegacy({ product: 'shirt', fit: 'Classic', collar: 'Point' }, 'suit'),
    ).toEqual({
      productCode: 'shirt',
      selections: { [K.shirtFit]: 'classic', [K.collar]: 'point' },
    });
    expect(
      garmentPatchFromLegacy({ customizations: { [K.vest]: '1', [K.lapel]: 'peak' } }, 'suit'),
    ).toEqual({ components: { vest: true }, selections: { [K.lapel]: 'peak' } });
    expect(garmentPatchFromLegacy({ customizations: { [K.lapel]: 'peak' } }, 'blazer')).toBeNull();
    expect(garmentPatchFromLegacy({ skinTone: 'tan' }, 'suit')).toBeNull();
  });
});
