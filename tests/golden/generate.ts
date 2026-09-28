import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { FABRICS, FITS, DETAIL_OPTIONS } from '../../src/modules/catalog/catalog';
import {
  SUIT_CUSTOMIZATION_SEED,
  type SuitGroup,
  type SuitSection,
} from '../../src/modules/catalog/suit-customization';
import { createDraft, applyCommand } from '../legacy/engine-v1';
import { designOutline } from '../../src/modules/configuration/design-outline';
import type { Command, CommandV2, Design } from '../../src/modules/configuration/types';
import { garmentPatchFromLegacy } from '../../src/modules/configuration/upgrade';
import { sketchSpec } from '../../src/visualization/sketch-spec';
import { add, draftWith, referenceIndex, renderOf, select } from '../helpers/reference';
import { regionForLeaf } from '../../src/visualization/focus-regions';
import { shownIn3D } from '../../src/visualization/garments/coverage';

// Golden visual outputs (WP-00b, CATALOG-ADMIN §6, AC-43), recorded from the
// renderers as they were before the catalog refactor. SYNTHETIC designs only.
//
// Since WP-14 the outputs are computed the new way: each case, still described
// by the v1 design commands it was recorded with, is translated to v2 garment
// commands on the imported reference release (v2Commands below), and the
// renderers read render values bound through the visual slot registry. Focus
// regions and 3D coverage read the catalog; the pre-catalog leaf ids map to the
// leaves that replaced them (LEGACY_LEAVES). The recorded JSON is unchanged.
//
// - sketch-spec.json: sketchSpec() for suit defaults, every seed choice applied
//   one at a time (with the vest and the group's gate opened where the choice
//   needs them to be drawn), and every legacy option of each product. Stored as
//   a baseline per product plus each case's exact differences. The 3D garments
//   (garments/*.ts) are generated from this same specification, and
//   tailored-human.tsx reads the trouser length that it records.
// - regions.json: regionForLeaf() for every leaf, per product, and for the
//   contextual focus changes (thread scope, changed pocket key, shirt fabric).
// - shown-in-3d.json: shownIn3D() for every leaf.
//
// Regenerate only with a written justification in the PR and an explicit
// reviewer sign-off (IMPLEMENTATION-PLAN.md WP-00b). Never regenerate a golden
// to make a failing comparison pass:
//   node --import tsx tests/golden/generate.ts

export const GOLDEN_DIR = path.dirname(fileURLToPath(import.meta.url));
export const GOLDEN_FILES = {
  sketchSpecs: 'sketch-spec.json',
  regions: 'regions.json',
  shownIn3D: 'shown-in-3d.json',
} as const;

type Case = { id: string; commands: Command[] };
const OFF_VALUES = new Set(['without', 'Without', 'By default', 'default', 'No bow tie', 'base']);
const VEST_TOGGLE = 'style.vest.waistcoat.waistcoat';

const design = (commands: Command[]) =>
  commands.reduce((draft, command) => applyCommand(draft, command), createDraft()).design;

/**
 * A case's v1 design commands as v2 commands for a garment of the case's
 * product. Choices of the two placeholder groups the importer archives
 * (pants_chinos, waistcoat_wedding) do not exist in the release; the v1
 * renderer never drew them.
 */
function v2Commands(product: Design['product'], commands: Command[]): CommandV2[] {
  const index = referenceIndex();
  const result: CommandV2[] = [add(product)];
  for (const command of commands) {
    if (command.type !== 'design') throw new Error('Golden cases are design commands.');
    // The garment already has the case's product.
    const { skinTone, ...rest } = command.patch;
    delete rest.product;
    if (skinTone) result.push({ type: 'appearance', skinTone });
    const converted = garmentPatchFromLegacy(rest, product);
    if (!converted) continue;
    if (converted.selections)
      converted.selections = Object.fromEntries(
        Object.entries(converted.selections).filter(([key]) => index.attributes.has(key)),
      );
    if (converted.selections && !Object.keys(converted.selections).length)
      delete converted.selections;
    if (Object.keys(converted).length) result.push({ type: 'design', patch: converted });
  }
  return result;
}
const caseProduct = (id: string) => id.split('/')[0] as Design['product'];
/** Render values of a case's garment, built by the v2 engine. */
const caseRender = (item: Case) =>
  renderOf(draftWith(...v2Commands(caseProduct(item.id), item.commands)));

/** Pre-catalog leaf ids and the leaves that replaced them, per product. */
function leafFor(id: string, product: Design['product'] = 'suit') {
  const legacy: Record<string, string> = {
    fabricId: 'fabric',
    fit: product === 'shirt' ? 'style.shirt.shirt_fit' : 'style.jacket.jacket_fit',
    lapel: 'style.jacket.jacket_lapel_type_combinated',
    pockets: 'style.jacket.jacket_pockets_type',
    closure: 'style.jacket.jacket_style_combined',
    collar: 'style.shirt.shirt_collar',
    cuffs: 'style.shirt.shirt_cuffs',
    // The waistcoat option became the vest part's include toggle.
    'style.vest.waistcoat': 'include:vest',
  };
  return legacy[id] ?? id;
}
const customize = (values: Record<string, string>): Command => ({
  type: 'design',
  patch: { customizations: values },
});
const patch = (value: Extract<Command, { type: 'design' }>['patch']): Command => ({
  type: 'design',
  patch: value,
});

/** Other selections that make a section's choice drawable: the vest, and the group's gate. */
function context(category: string, group: SuitGroup, section: SuitSection) {
  const values: Record<string, string> = {};
  if (category === 'vest' && section.selectionKey !== VEST_TOGGLE) values[VEST_TOGGLE] = '1';
  const [first] = group.sections;
  if (first && first !== section) {
    const opening =
      first.options.find((option) => option.value === 'personalizado') ??
      (first.options.some((option) => OFF_VALUES.has(option.value))
        ? first.options.find((option) => !OFF_VALUES.has(option.value))
        : undefined);
    if (opening) values[first.selectionKey] = opening.value;
  }
  return values;
}

/** Suit defaults, every seed choice one at a time, and every legacy option of each product. */
export function goldenCases(): Case[] {
  const cases: Case[] = [{ id: 'suit/defaults', commands: [] }];
  for (const menu of SUIT_CUSTOMIZATION_SEED.menus)
    for (const category of menu.categories)
      for (const group of category.groups)
        for (const section of group.sections)
          for (const option of section.options)
            cases.push({
              id: `suit/${section.selectionKey}=${option.value}`,
              commands: [
                customize({
                  ...context(category.id, group, section),
                  [section.selectionKey]: option.value,
                }),
              ],
            });
  for (const fit of FITS) cases.push({ id: `suit/fit=${fit}`, commands: [patch({ fit })] });
  for (const fabric of FABRICS.filter((item) => item.products.includes('suit')))
    cases.push({ id: `suit/fabricId=${fabric.id}`, commands: [patch({ fabricId: fabric.id })] });
  for (const skinTone of ['porcelain', 'warm', 'tan', 'deep'] as const)
    cases.push({ id: `suit/skinTone=${skinTone}`, commands: [patch({ skinTone })] });
  for (const product of ['shirt', 'blazer'] as const) {
    const start = patch({ product });
    cases.push({ id: `${product}/defaults`, commands: [start] });
    for (const fit of FITS)
      cases.push({ id: `${product}/fit=${fit}`, commands: [start, patch({ fit })] });
    const details =
      product === 'shirt'
        ? (['collar', 'cuffs'] as const)
        : (['lapel', 'pockets', 'closure'] as const);
    for (const key of details)
      for (const value of DETAIL_OPTIONS[key])
        cases.push({
          id: `${product}/${key}=${value}`,
          commands: [start, patch({ [key]: value })],
        });
    for (const fabric of FABRICS.filter((item) => item.products.includes(product)))
      cases.push({
        id: `${product}/fabricId=${fabric.id}`,
        commands: [start, patch({ fabricId: fabric.id })],
      });
  }
  return cases;
}

/** Every leaf id of the three products' outlines (suit with a vest), plus every seed group. */
function leafIds(outlines: { product: Design['product']; design: Design }[]) {
  const ids = new Set<string>();
  for (const { design } of outlines)
    for (const branch of designOutline(design)) for (const leaf of branch.leaves) ids.add(leaf.id);
  for (const menu of SUIT_CUSTOMIZATION_SEED.menus)
    for (const category of menu.categories)
      for (const group of category.groups) ids.add(`${menu.id}.${category.id}.${group.id}`);
  return [...ids].sort();
}

// JSON round trip: the goldens hold exactly what JSON can hold (undefined keys dropped).
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
/** Marks a key present in the product baseline but absent from the case. */
export const ABSENT = { $absent: true } as const;
const isObject = (value: unknown): value is Record<string, Json> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Paths (dot-separated) whose values differ from the baseline; lossless for JSON data. */
export function specDifferences(
  base: Json,
  next: Json,
  prefix = '',
  out: Record<string, Json> = {},
) {
  if (isObject(base) && isObject(next)) {
    for (const key of [...new Set([...Object.keys(base), ...Object.keys(next)])].sort()) {
      const at = prefix ? `${prefix}.${key}` : key;
      if (!(key in next)) out[at] = ABSENT;
      else if (!(key in base)) out[at] = next[key];
      else specDifferences(base[key], next[key], at, out);
    }
  } else if (JSON.stringify(base) !== JSON.stringify(next)) out[prefix] = next;
  return out;
}

/** Rebuilds a case's full specification from its product baseline and recorded differences. */
export function applyDifferences(base: Json, differences: Record<string, Json>) {
  const result = structuredClone(base) as Record<string, Json>;
  for (const [at, value] of Object.entries(differences)) {
    const keys = at.split('.');
    let node = result;
    for (const key of keys.slice(0, -1)) {
      if (!isObject(node[key])) node[key] = {};
      node = node[key] as Record<string, Json>;
    }
    const last = keys[keys.length - 1];
    if (isObject(value) && value.$absent === true) delete node[last];
    else node[last] = structuredClone(value);
  }
  return result;
}

/** Full sketch specifications for every case, keyed by case id. */
export function computeSketchSpecs() {
  return Object.fromEntries(
    goldenCases().map((item) => [item.id, plain(sketchSpec(caseRender(item))) as Json]),
  );
}

export function buildGoldens() {
  const full = computeSketchSpecs();
  const baselines = {
    suit: full['suit/defaults'],
    shirt: full['shirt/defaults'],
    blazer: full['blazer/defaults'],
  };
  const sketchSpecs = {
    baselines,
    cases: Object.fromEntries(
      Object.entries(full).map(([id, spec]) => [
        id,
        specDifferences(baselines[id.split('/')[0] as keyof typeof baselines], spec),
      ]),
    ),
  };
  const outlines = [
    { product: 'suit' as const, design: design([customize({ [VEST_TOGGLE]: '1' })]) },
    { product: 'shirt' as const, design: design([patch({ product: 'shirt' })]) },
    { product: 'blazer' as const, design: design([patch({ product: 'blazer' })]) },
  ];
  const ids = leafIds(outlines);
  const byProduct = Object.fromEntries(
    outlines.map(({ product, design }) => [
      product,
      Object.fromEntries(
        designOutline(design)
          .flatMap((branch) => branch.leaves)
          .map((leaf) => [
            leaf.id,
            regionForLeaf(leafFor(leaf.id, product), { index: referenceIndex(), product }),
          ]),
      ),
    ]),
  );
  const threadScope = 'accents.jacket.button_holes_threads.button-threads-holes';
  const pockets = SUIT_CUSTOMIZATION_SEED.menus[0].categories
    .find((category) => category.id === 'pants')!
    .groups.find((group) => group.id === 'pants_pockets')!;
  const regions = {
    byLeaf: Object.fromEntries(
      ids.map((id) => [id, regionForLeaf(leafFor(id), { index: referenceIndex() })]),
    ),
    byProduct,
    contextual: {
      threadScope: Object.fromEntries(
        ['By default', 'all', 'cuff', 'lapel'].map((scope) => [
          scope,
          regionForLeaf('accents.jacket.button_holes_threads', {
            index: referenceIndex(),
            tokens: renderOf(draftWith(add('suit'), select({ [threadScope]: scope }))).tokens,
          }),
        ]),
      ),
      pantsPocketsChangedKey: Object.fromEntries(
        pockets.sections.map((section) => [
          section.selectionKey,
          regionForLeaf('style.pants.pants_pockets', {
            index: referenceIndex(),
            changedKey: section.selectionKey,
          }),
        ]),
      ),
      shirtFabric: regionForLeaf(leafFor('fabricId'), {
        index: referenceIndex(),
        product: 'shirt',
      }),
    },
  };
  const shown = Object.fromEntries(ids.map((id) => [id, shownIn3D(leafFor(id), referenceIndex())]));
  return { sketchSpecs, regions, shownIn3D: shown };
}

async function writeGoldens() {
  const goldens = buildGoldens();
  const config = (await resolveConfig(path.join(GOLDEN_DIR, 'x.json'))) ?? {};
  for (const [key, file] of Object.entries(GOLDEN_FILES)) {
    const target = path.join(GOLDEN_DIR, file);
    const text = await format(JSON.stringify(goldens[key as keyof typeof goldens]), {
      ...config,
      parser: 'json',
    });
    await writeFile(target, text);
    console.log(`Wrote ${path.relative(process.cwd(), target)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await writeGoldens();
