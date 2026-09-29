import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  COMPONENT_DRIVEN_KEYS,
  REGION_IDS,
  SLOT_IDS,
  VISUAL_SLOTS,
  isRegionId,
  isTokenOf,
  slotForKey,
} from '../src/visualization/registry';
import { LEAF_REGIONS, REGIONS } from '../src/visualization/focus-regions';
import { SUIT_CUSTOMIZATION_SEED } from '../src/modules/catalog/suit-customization';
import {
  IMPORTED_EXTRA_VALUES,
  LEGACY_KEYS,
  LEGACY_SHIRT_VALUES,
} from '../src/modules/catalog/legacy-mapping';

// CATALOG-ADMIN.md §6 / TASK-015 step 4: slots and tokens are derived from the
// renderer code and the seed, not invented.

const seedValues = new Map<string, string[]>();
const seedGroups: { leafId: string; keys: string[] }[] = [];
for (const menu of SUIT_CUSTOMIZATION_SEED.menus)
  for (const category of menu.categories)
    for (const group of category.groups) {
      seedGroups.push({
        leafId: `${menu.id}.${category.id}.${group.id}`,
        keys: group.sections.map((section) => section.selectionKey),
      });
      for (const section of group.sections)
        seedValues.set(
          section.selectionKey,
          section.options.map((option) => option.value),
        );
    }
/** Every value a key can hold once imported. */
const domain = (key: string) => [
  ...(seedValues.get(key) ?? []),
  ...(LEGACY_SHIRT_VALUES[key] ?? []),
  ...(IMPORTED_EXTRA_VALUES[key] ?? []),
];

const source = (file: string) =>
  readFile(path.join(process.cwd(), 'src/visualization', file), 'utf8');
const FULL_KEY = /'((?:style|accents)\.[\w-]+\.[\w-]+\.[\w-]+)'/g;

/** The renderer sources: the drawing specification, 3D garments, focus and binding. */
async function rendererFiles() {
  return [
    'sketch-spec.ts',
    'tailored-human.tsx',
    'focus-regions.ts',
    'binding.ts',
    'outfit.tsx',
    'garment-sketch.tsx',
    ...(await readdir(path.join(process.cwd(), 'src/visualization/garments'))).map(
      (file) => `garments/${file}`,
    ),
  ];
}

/** Slot ids the renderers read (WP-14: they read render values, not selection keys). */
async function slotsReadByRenderers() {
  const slots = new Set<string>();
  const sketch = await source('sketch-spec.ts');
  // Calls may be wrapped over several lines by Prettier.
  for (const [, slot] of sketch.matchAll(/\b(?:t|image)\(\s*'([^']+)'\s*,?\s*\)/g)) slots.add(slot);
  for (const [, on, product] of sketch.matchAll(
    /\baccessory\(\s*'([^']+)',\s*'([^']+)'\s*,?\s*\)/g,
  )) {
    slots.add(on);
    slots.add(product);
  }
  for (const file of await rendererFiles())
    for (const [, slot] of (await source(file)).matchAll(/visualSlot === '([^']+)'/g))
      slots.add(slot);
  return slots;
}

describe('visual slot registry', () => {
  it('renderers read only registered slots, never catalog selection keys (CAT-014)', async () => {
    const read = await slotsReadByRenderers();
    expect(read.size).toBeGreaterThan(40);
    for (const slot of read) expect(SLOT_IDS, slot).toContain(slot);
    for (const file of await rendererFiles())
      expect(
        [...(await source(file)).matchAll(FULL_KEY)].map((m) => m[1]),
        file,
      ).toEqual([]);
  });

  it('draws every registered slot', async () => {
    const read = await slotsReadByRenderers();
    for (const slot of SLOT_IDS) expect(read.has(slot), slot).toBe(true);
  });

  it('binds only seed selection keys or legacy design fields', () => {
    const legacy = new Set<string>(Object.values(LEGACY_KEYS));
    for (const slot of SLOT_IDS)
      for (const key of VISUAL_SLOTS[slot].keys)
        expect(seedValues.has(key) || legacy.has(key), `${slot}: ${key}`).toBe(true);
    // The vest is drawn when the vest part is included, not from a choice.
    expect(COMPONENT_DRIVEN_KEYS).toEqual({ [LEGACY_KEYS.vest]: 'vest' });
  });

  it('binds each key to exactly one slot', () => {
    const keys = SLOT_IDS.flatMap((slot) => VISUAL_SLOTS[slot].keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has every value of a bound key as a token', () => {
    for (const slot of SLOT_IDS)
      for (const key of VISUAL_SLOTS[slot].keys) {
        expect(domain(key).length, key).toBeGreaterThan(0);
        for (const value of domain(key))
          expect(isTokenOf(slot, value), `${slot}: ${value}`).toBe(true);
      }
  });

  it('has only tokens that exist in the seed, the imported legacy choices or the code', () => {
    for (const slot of SLOT_IDS) {
      const { tokens, keys } = VISUAL_SLOTS[slot];
      expect(new Set(tokens).size, slot).toBe(tokens.length);
      const known = new Set(keys.flatMap(domain));
      for (const token of tokens) expect(known.has(token), `${slot}: ${token}`).toBe(true);
    }
  });

  it('reproduces the recorded 3D coverage when derived from the slots of a group’s options', async () => {
    const recorded: Record<string, boolean> = JSON.parse(
      await readFile(path.join(process.cwd(), 'tests/golden/shown-in-3d.json'), 'utf8'),
    );
    const shownIn3D = (leafId: string) => recorded[leafId];
    for (const { leafId, keys } of seedGroups) {
      if (keys.some((key) => key in COMPONENT_DRIVEN_KEYS)) continue;
      const derived = keys.some((key) => {
        const slot = slotForKey(key);
        return slot ? VISUAL_SLOTS[slot].shownIn3D : false;
      });
      expect(derived, leafId).toBe(shownIn3D(leafId));
    }
    // Legacy leaves of shirts and blazers.
    const legacy: Record<string, string> = {
      fit: LEGACY_KEYS.jacketFit,
      lapel: LEGACY_KEYS.lapelType,
      pockets: LEGACY_KEYS.pocketsType,
      closure: LEGACY_KEYS.jacketStyle,
      collar: LEGACY_KEYS.shirtCollar,
      cuffs: LEGACY_KEYS.shirtCuffs,
    };
    for (const [leafId, key] of Object.entries(legacy))
      expect(VISUAL_SLOTS[slotForKey(key)!].shownIn3D, leafId).toBe(shownIn3D(leafId));
    // The vest toggle is drawn in 3D and is driven by including the vest.
    expect(shownIn3D('style.vest.waistcoat')).toBe(true);
  });

  it('uses only known visual models', () => {
    for (const slot of SLOT_IDS)
      for (const model of VISUAL_SLOTS[slot].visualModels)
        expect(['suit', 'shirt', 'blazer'], slot).toContain(model);
  });
});

describe('region ids', () => {
  it('lists every drawing region', () => {
    expect(REGION_IDS.sort()).toEqual(Object.keys(REGIONS).sort());
    expect(REGION_IDS).toHaveLength(20);
    expect(isRegionId('collar')).toBe(true);
    expect(isRegionId('lapel')).toBe(false);
  });

  it('maps every LEAF_REGIONS entry to a RegionId', () => {
    for (const [leafId, region] of Object.entries(LEAF_REGIONS))
      expect(isRegionId(region), leafId).toBe(true);
  });
});
