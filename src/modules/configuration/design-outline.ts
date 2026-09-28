import { DETAIL_OPTIONS, PRODUCTS, fabricFor } from '../catalog/catalog';
import {
  SUIT_CUSTOMIZATION_SEED,
  defaultSuitCustomizations,
  hasVest,
  optionFor,
  type SuitCategory,
  type SuitGroup,
  type SuitMenu,
  type SuitSection,
} from '../catalog/suit-customization';
import type { Design } from './types';

// One hierarchy for every input surface: the field navigator, the selection
// tags and the 2D focus all read from this outline, so they cannot drift apart.

export type LeafKind = 'product' | 'occasion' | 'climate' | 'fabric' | 'fit' | 'detail' | 'catalog';

export type OutlineLeaf = {
  /** Stable ID: a design field name, or `menu.category.group` for catalog groups. */
  id: string;
  branchId: BranchId;
  kind: LeafKind;
  label: string;
  /** Short customer-facing summary of the current choice. */
  value: string;
  /** Design fields or customization selection keys edited by this leaf. */
  keys: string[];
  /** The customer chose this explicitly, or it differs from the reference default. */
  customized: boolean;
  swatch?: string;
  asset?: string | null;
  /** Subheading within a branch, used for accents. */
  section?: string;
  /** Catalog group reference for catalog leaves. */
  group?: SuitGroup;
};

export type BranchId = 'essentials' | 'jacket' | 'pants' | 'vest' | 'accents';

export type OutlineBranch = {
  id: BranchId;
  label: string;
  description: string;
  leaves: OutlineLeaf[];
};

const SUIT_DEFAULTS = defaultSuitCustomizations();
export const OFF_VALUES = new Set([
  'without',
  'Without',
  'By default',
  'default',
  'No bow tie',
  'base',
]);

function menu(id: SuitMenu['id']) {
  return SUIT_CUSTOMIZATION_SEED.menus.find((item) => item.id === id)!;
}

/** Customer-readable text for a seed option label. */
export function cleanOptionLabel(label: string) {
  const text = label
    .replace(/^color_(\d+)$/, 'Colour $1')
    .replace(/^item_(\d+)$/, 'Colour $1')
    .replace(/^without$/i, 'None')
    .replace(/^no$/i, 'No')
    .replace(/^yes$/i, 'Yes')
    .replace(/^add$/i, 'Added')
    .replace(/^personalizado$/i, 'Custom');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function readableLabel(label: string) {
  if (label === label.toUpperCase()) return label.charAt(0) + label.slice(1).toLowerCase();
  return label;
}

/**
 * A group's first section can gate its detail sections, such as “Necktie: add”
 * before choosing a tie. Returns the sections that currently apply.
 */
export function relevantSections(group: SuitGroup, values: Record<string, string>) {
  const [first, ...rest] = group.sections;
  if (!first || !rest.length) return group.sections;
  const current = values[first.selectionKey];
  const hasCustom = first.options.some((option) => option.value === 'personalizado');
  if (hasCustom) return current === 'personalizado' ? group.sections : [first];
  const off = first.options.find((option) => OFF_VALUES.has(option.value));
  if (off) return current && current !== off.value ? group.sections : [first];
  return group.sections;
}

function sectionValue(section: SuitSection, values: Record<string, string>) {
  const option = optionFor(section.selectionKey, values[section.selectionKey]);
  return option ? cleanOptionLabel(option.label) : 'Not chosen';
}

/** Groups visible for the current suit configuration. Placeholder groups stay hidden. */
export function visibleGroups(
  menuId: SuitMenu['id'],
  category: SuitCategory,
  values: Record<string, string>,
) {
  const vest = hasVest(values);
  if (category.id === 'vest' && menuId === 'accents' && !vest) return [];
  return category.groups.filter(
    (group) =>
      group.label !== group.id &&
      (group.shown || (category.id === 'vest' && vest)) &&
      group.sections.length > 0,
  );
}

function catalogLeaf(
  menuId: SuitMenu['id'],
  category: SuitCategory,
  group: SuitGroup,
  values: Record<string, string>,
  branchId: BranchId,
): OutlineLeaf {
  const sections = relevantSections(group, values);
  const keys = group.sections.map((section) => section.selectionKey);
  return {
    id: `${menuId}.${category.id}.${group.id}`,
    branchId,
    kind: 'catalog',
    label: readableLabel(group.shortLabel),
    value: sections.map((section) => sectionValue(section, values)).join(' · '),
    keys,
    customized: keys.some((key) => (values[key] ?? '') !== (SUIT_DEFAULTS[key] ?? '')),
    asset: group.asset,
    section: menuId === 'accents' ? readableLabel(category.label) : undefined,
    group,
  };
}

export function designOutline(design: Design): OutlineBranch[] {
  const fabric = fabricFor(design.fabricId);
  const confirmed = new Set(design.confirmed);
  const essentials: OutlineLeaf[] = [
    {
      id: 'product',
      branchId: 'essentials',
      kind: 'product',
      label: 'Garment',
      value: PRODUCTS[design.product].name,
      keys: ['product'],
      customized: confirmed.has('product'),
    },
    {
      id: 'occasion',
      branchId: 'essentials',
      kind: 'occasion',
      label: 'Occasion',
      value: design.occasion || 'Not chosen',
      keys: ['occasion'],
      customized: !!design.occasion,
    },
    {
      id: 'climate',
      branchId: 'essentials',
      kind: 'climate',
      label: 'Weather',
      value: design.climate || 'Not chosen',
      keys: ['climate'],
      customized: !!design.climate,
    },
    {
      id: 'fabricId',
      branchId: 'essentials',
      kind: 'fabric',
      label: 'Fabric',
      value: fabric?.name || 'Not chosen',
      keys: ['fabricId'],
      customized: confirmed.has('fabricId'),
      swatch: fabric?.color,
    },
    {
      id: 'fit',
      branchId: 'essentials',
      kind: 'fit',
      label: 'Fit',
      value: design.fit,
      keys: ['fit'],
      customized: confirmed.has('fit'),
    },
  ];
  // Suit lapel, pocket and fastening choices live in the full jacket catalog.
  if (design.product !== 'suit')
    for (const key of design.product === 'shirt'
      ? (['collar', 'cuffs'] as const)
      : (['lapel', 'pockets', 'closure'] as const))
      essentials.push({
        id: key,
        branchId: 'essentials',
        kind: 'detail',
        label: key === 'closure' ? 'Fastening' : key.charAt(0).toUpperCase() + key.slice(1),
        value: design[key],
        keys: [key],
        customized: design[key] !== DETAIL_OPTIONS[key][0],
      });
  const branches: OutlineBranch[] = [
    {
      id: 'essentials',
      label: 'The essentials',
      description:
        design.product === 'suit'
          ? 'Garment, occasion, fabric and fit'
          : 'Garment, occasion, fabric, fit and finishing',
      leaves: essentials,
    },
  ];
  if (design.product !== 'suit') return branches;
  const values = { ...SUIT_DEFAULTS, ...(design.customizations || {}) };
  const style = menu('style');
  const accents = menu('accents');
  const styleBranch = (id: 'jacket' | 'pants' | 'vest', label: string, description: string) => {
    const category = style.categories.find((item) => item.id === id);
    return {
      id,
      label,
      description,
      leaves: category
        ? visibleGroups('style', category, values).map((group) =>
            catalogLeaf('style', category, group, values, id),
          )
        : [],
    } satisfies OutlineBranch;
  };
  branches.push(
    styleBranch('jacket', 'Jacket', 'Style, lapels, pockets, sleeves and back'),
    styleBranch('pants', 'Trousers', 'Fit, length, pleats, fastening and pockets'),
    styleBranch('vest', 'Vest', 'Add a waistcoat and shape its details'),
    {
      id: 'accents',
      label: 'Accents',
      description: 'Lining, monogram, buttons, threads and accessories',
      leaves: accents.categories.flatMap((category) =>
        visibleGroups('accents', category, values).map((group) =>
          catalogLeaf('accents', category, group, values, 'accents'),
        ),
      ),
    },
  );
  return branches;
}

export function findLeaf(outline: OutlineBranch[], leafId: string) {
  for (const branch of outline) {
    const leaf = branch.leaves.find((item) => item.id === leafId);
    if (leaf) return leaf;
  }
  return undefined;
}

function valueOf(design: Design, key: string) {
  if (key.includes('.')) return design.customizations?.[key] ?? SUIT_DEFAULTS[key] ?? '';
  return String(design[key as keyof Design] ?? '');
}

/** Leaves, and their keys, whose values differ between two designs, in outline order. */
export function changedLeaves(before: Design, after: Design) {
  return designOutline(after).flatMap((branch) =>
    branch.leaves.flatMap((leaf) => {
      const keys = leaf.keys.filter((key) => valueOf(before, key) !== valueOf(after, key));
      return keys.length ? [{ leafId: leaf.id, keys }] : [];
    }),
  );
}
