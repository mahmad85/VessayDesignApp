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
import { shownIn3D } from '../src/visualization/garments/coverage';
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

/** Selection keys the renderers read, reconstructed from their source text. */
async function keysReadByRenderers() {
  const keys = new Set<string>();
  // Template placeholders such as `${group}` are resolved through the products() calls.
  const add = (key: string) => (key.includes('${') ? keys : keys.add(key));
  const sketch = await source('sketch-spec.ts');
  // Calls may be wrapped over several lines by Prettier.
  for (const [, key] of sketch.matchAll(/\bs\(\s*'([^']+)'\s*,?\s*\)/g)) add(`style.${key}`);
  for (const [, key] of sketch.matchAll(/\ba\(\s*'([^']+)'\s*,?\s*\)/g)) add(`accents.${key}`);
  for (const [, key] of sketch.matchAll(/asset\(\s*values,\s*`\$\{ACCENTS\}([^`]+)`\s*,?\s*\)/g))
    add(`accents.${key}`);
  for (const [, group, toggle] of sketch.matchAll(
    /products\(\s*'([^']+)',\s*'([^']+)'\s*,?\s*\)/g,
  )) {
    add(`accents.${group}.${toggle}`);
    add(`accents.${group}.products`);
  }
  if (/\bhasVest\(/.test(sketch)) add(LEGACY_KEYS.vest);
  const files = [
    'sketch-spec.ts',
    'tailored-human.tsx',
    'focus-regions.ts',
    ...(await readdir(path.join(process.cwd(), 'src/visualization/garments'))).map(
      (file) => `garments/${file}`,
    ),
  ];
  for (const file of files) {
    const text = await source(file);
    for (const [, key] of text.matchAll(FULL_KEY)) add(key);
    for (const [, suffix] of text.matchAll(/changedKey\?\.endsWith\('([^']+)'\)/g))
      for (const key of seedValues.keys()) if (key.endsWith(suffix)) add(key);
  }
  return keys;
}

describe('visual slot registry', () => {
  it('has a slot for every selection key the renderers read', async () => {
    const read = await keysReadByRenderers();
    expect(read.size).toBeGreaterThan(40);
    for (const key of read)
      expect(
        slotForKey(key) ?? (key in COMPONENT_DRIVEN_KEYS ? 'component' : undefined),
        key,
      ).toBeDefined();
  });

  it('binds only keys the renderers read, or legacy design fields they read', async () => {
    const read = await keysReadByRenderers();
    const legacy = new Set<string>(Object.values(LEGACY_KEYS));
    for (const slot of SLOT_IDS)
      for (const key of VISUAL_SLOTS[slot].keys)
        expect(read.has(key) || legacy.has(key), `${slot}: ${key}`).toBe(true);
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

  it('reproduces today’s 3D coverage when derived from the slots of a group’s options', () => {
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
