import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { CommandV2, DraftV2 } from '../src/modules/configuration/types';
import { visibleStructure } from '../src/modules/catalog/structure';
import { sketchSpec } from '../src/visualization/sketch-spec';
import {
  activeGarment,
  add,
  draftWith,
  referenceIndex,
  renderOf,
  select,
} from './helpers/reference';
import {
  jacketField,
  outfitParts,
  shirtField,
  vestField,
  waistbandField,
} from '../src/visualization/garments/garments';
import { shownIn3D } from '../src/visualization/garments/coverage';
import { torsoCenterZ } from '../src/visualization/garments/body-profile';

// SYNTHETIC v2 garments on the imported reference release (ported from the
// v1 designs in WP-14; every assertion kept).
type Design = DraftV2;
const FIT = 'style.jacket.jacket_fit.jacket-fit';
const start = (product: string, ...commands: CommandV2[]) => draftWith(add(product), ...commands);
const design = (...commands: CommandV2[]) => start('suit', ...commands);
const custom = select;
const withVest: CommandV2 = { type: 'design', patch: { components: { vest: true } } };
const parts = (d: Design) => outfitParts(sketchSpec(renderOf(d)));
const keys = (d: Design) => parts(d).map((p) => p.key);
function signature(d: Design) {
  let sum = 0;
  for (const part of parts(d)) {
    const pos = part.geometry.getAttribute('position').array;
    for (let i = 0; i < pos.length; i += 7) sum += pos[i] * ((i % 13) + 1);
    sum += (part.matrices?.length ?? 0) * 1000;
  }
  return sum.toFixed(3);
}

describe('generated 3D garments', () => {
  it('produce finite geometry for every product and closure style', () => {
    const designs = [
      design(),
      start('shirt'),
      start('blazer', select({ [FIT]: 'relaxed' })),
      ...['simple_1', 'simple_3', 'crossed_2', 'crossed_4', 'crossed_6', 'mao'].map((style) =>
        design(custom({ 'style.jacket.jacket_style_combined.jacket-style-combined': style })),
      ),
    ];
    for (const d of designs)
      for (const part of parts(d)) {
        const pos = part.geometry.getAttribute('position').array;
        expect(pos.length, part.key).toBeGreaterThan(0);
        expect(Array.from(pos).every(Number.isFinite), part.key).toBe(true);
      }
  });

  it('draws the chosen construction, not only a label', () => {
    const base = keys(design());
    expect(base).toEqual(expect.arrayContaining(['lapel-left', 'collar-left', 'pocket-1']));
    const mao = keys(
      design(custom({ 'style.jacket.jacket_style_combined.jacket-style-combined': 'mao' })),
    );
    expect(mao).toContain('mandarin-collar');
    expect(mao).not.toContain('lapel-left');
    const db = parts(
      design(custom({ 'style.jacket.jacket_style_combined.jacket-style-combined': 'crossed_6' })),
    ).find((p) => p.key === 'front-buttons')!;
    expect(db.matrices).toHaveLength(6);
    expect(
      keys(design(custom({ 'style.jacket.jacket_pockets_type.jacket-pockets-type': '0' }))),
    ).not.toContain('pocket-1');
    expect(
      keys(design(custom({ 'style.jacket.jacket_pockets_type.jacket-pockets-type': '3' }))),
    ).toContain('ticket');
    expect(
      keys(design(custom({ 'style.jacket.jacket_vent.jacket-vent': '2' }))).filter((k) =>
        k.startsWith('vent'),
      ),
    ).toHaveLength(2);
    const sleeve = parts(
      design(
        custom({ 'style.jacket.jacket_sleeve_buttons_combinated.jacket-sleeve-buttons': '4' }),
      ),
    ).find((p) => p.key === 'sleeve-buttons')!;
    expect(sleeve.matrices).toHaveLength(8);
    expect(keys(design(withVest))).toContain('vest');
    expect(keys(design(custom({ 'style.pants.pants_cuff.pants-cuff': '1' })))).toContain(
      'turn-up-left',
    );
    const shirt = keys(start('shirt'));
    expect(shirt).not.toContain('jacket');
    expect(shirt).toContain('sleeve-left');
  });

  it('changes 3D geometry for every main shape choice', () => {
    const base = signature(design());
    const changes: CommandV2[] = [
      select({ [FIT]: 'relaxed' }),
      custom({ 'style.jacket.jacket_style_combined.jacket-style-combined': 'simple_1' }),
      custom({ 'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type': 'peak' }),
      custom({ 'style.jacket.jacket_lapel_type_combinated.jacket-wide-lapel': 'width' }),
      custom({ 'style.jacket.jacket_pockets_type.jacket-pockets-type': '2' }),
      custom({ 'style.jacket.jacket_sleeve_buttons_combinated.jacket-sleeve-buttons': '4' }),
      custom({ 'style.jacket.jacket_vent.jacket-vent': '0' }),
      custom({ 'style.jacket.jacket_chest_pocket.jacket-chest-pocket': 'patched_2' }),
      custom({ 'style.pants.pants_fit.pants-fit': 'fit' }),
      custom({ 'style.pants.pants_length.pants-length': 'bermuda' }),
      custom({ 'style.pants.pants_break.pants-break': 'full' }),
      custom({ 'style.pants.pants_cuff.pants-cuff': '1' }),
      withVest,
    ];
    for (const change of changes)
      expect(signature(design(change)), JSON.stringify(change)).not.toBe(base);
    const vest = design(withVest);
    expect(
      signature(
        design(withVest, custom({ 'style.vest.waistcoat_bottom.waistcoat-bottom': 'straight' })),
      ),
    ).not.toBe(signature(vest));
  });

  it('keeps each layer outside the one beneath it', () => {
    for (const fit of ['slim', 'regular', 'relaxed'] as const) {
      const jacket = jacketField(fit),
        vest = vestField(fit),
        shirt = shirtField(fit, false),
        band = waistbandField(false);
      for (let i = 0; i < 48; i++) {
        const angle = (i / 48) * Math.PI * 2;
        for (const y of [1.95, 1.99])
          expect(jacket.radius(y, angle)).toBeGreaterThan(band.radius(y, angle) + 0.005);
        expect(vest.radius(1.96, angle)).toBeGreaterThan(band.radius(1.96, angle) + 0.003);
        for (const y of [2.1, 2.4, 2.7]) {
          expect(vest.radius(y, angle)).toBeGreaterThan(shirt.radius(y, angle));
          expect(jacket.radius(y, angle)).toBeGreaterThan(vest.radius(y, angle));
        }
      }
    }
    // Sanity: the fields are centred on the body.
    expect(new THREE.Vector3(0, 2.4, torsoCenterZ(2.4)).z).toBeLessThan(0.2);
  });

  it('marks only real outline choices as drawn in 3D', () => {
    const index = referenceIndex();
    const leaves = new Set(
      [design(withVest), start('blazer'), start('shirt')].flatMap(
        (d) =>
          visibleStructure(index, activeGarment(d))?.tabs.flatMap((tab) =>
            tab.groups.map((group) => group.group.code),
          ) ?? [],
      ),
    );
    for (const code of index.groups.keys())
      if (shownIn3D(code, index)) expect(leaves.has(code), code).toBe(true);
    expect(shownIn3D('accents.jacket.lining', index)).toBe(false);
    expect(shownIn3D('style.jacket.jacket_lapel_type_combinated', index)).toBe(true);
    expect(shownIn3D('include:vest', index)).toBe(true);
  });
});
