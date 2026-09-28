import { materialsFor } from '../catalog/garment';
import { valueKey, type RuntimeIndex } from '../catalog/snapshot';
import {
  effectiveSelections,
  visibleStructure,
  type StructureGroup,
  type StructureInclude,
} from '../catalog/structure';
import type { Garment } from './types';

// One hierarchy for every input surface: the field navigator, the selection
// tags and the 2D focus all read from this outline, so they cannot drift apart.
// Built from the catalog release (CATALOG-ADMIN §2.1): the fixed Essentials
// leaves, then the visible groups of each customer tab. Leaf id = group code;
// a part's include toggle is `include:<component code>`.

export type LeafKind = 'product' | 'occasion' | 'climate' | 'fabric' | 'component' | 'catalog';

export type OutlineLeaf = {
  id: string;
  branchId: BranchId;
  kind: LeafKind;
  label: string;
  /** Short customer-facing summary of the current choice. */
  value: string;
  /** Option (attribute) codes edited by this leaf; the field name for fixed leaves. */
  keys: string[];
  /** The customer chose this explicitly, or it differs from the product default. */
  customized: boolean;
  swatch?: string;
  asset?: string | null;
  /** Subheading within a branch: the part name for accents. */
  section?: string;
  /** The catalog group and its visible options, for catalog leaves. */
  group?: StructureGroup;
  /** The optional part, for include toggles. */
  include?: StructureInclude;
};

/** `essentials`, a component code, or `accents`. */
export type BranchId = string;

export type OutlineBranch = {
  id: BranchId;
  label: string;
  description: string;
  leaves: OutlineLeaf[];
};

// Import helpers for the supplied seed labels (CATALOG-ADMIN §10).
export const OFF_VALUES = new Set([
  'without',
  'Without',
  'By default',
  'default',
  'No bow tie',
  'base',
]);

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

const NOT_CHOSEN = 'Not chosen';

export function lookupLabel(index: RuntimeIndex, type: string, code: string | null) {
  return code ? (index.lookups.get(type)?.get(code)?.label ?? code) : NOT_CHOSEN;
}

/** The customer label of a choice (or the text of a text option). */
export function choiceLabel(index: RuntimeIndex, attributeCode: string, value: string | undefined) {
  if (value === undefined || value.trim() === '') return NOT_CHOSEN;
  const entry = index.attributes.get(attributeCode);
  if (entry?.attribute.inputType === 'text') return value;
  return index.values.get(valueKey(attributeCode, value))?.value.label ?? value;
}

function groupLeaf(
  index: RuntimeIndex,
  item: StructureGroup,
  branchId: BranchId,
  section?: string,
): OutlineLeaf {
  const icon = item.group.iconMediaId ? index.media.get(item.group.iconMediaId)?.url : undefined;
  return {
    id: item.group.code,
    branchId,
    kind: 'catalog',
    label: item.group.shortName || item.group.name,
    value: item.attributes
      .map((entry) => choiceLabel(index, entry.attribute.code, entry.value))
      .join(' · '),
    keys: item.attributes.map((entry) => entry.attribute.code),
    customized: item.attributes.some((entry) =>
      entry.attribute.inputType === 'text'
        ? !!entry.value?.trim()
        : (entry.value ?? null) !== entry.defaultValue,
    ),
    asset: icon ?? null,
    section,
    group: item,
  };
}

export function designOutline(index: RuntimeIndex, garment: Garment): OutlineBranch[] {
  const structure = visibleStructure(index, garment);
  if (!structure) return [];
  const { product } = structure;
  const material = index.materials.get(garment.materialCode);
  const confirmed = new Set(garment.confirmed);
  const multiPart = structure.tabs.some((tab) => tab.kind === 'component');
  const branches: OutlineBranch[] = [];
  for (const tab of structure.tabs) {
    if (tab.kind === 'essentials') {
      branches.push({
        id: tab.id,
        label: tab.label,
        description: multiPart
          ? 'Garment, occasion, weather and fabric'
          : 'Garment, occasion, fabric, fit and finishing',
        leaves: [
          {
            id: 'product',
            branchId: tab.id,
            kind: 'product',
            label: 'Garment',
            value: product.name,
            keys: ['product'],
            customized: confirmed.has('product'),
          },
          {
            id: 'occasion',
            branchId: tab.id,
            kind: 'occasion',
            label: 'Occasion',
            value: lookupLabel(index, 'occasion', garment.preferences.occasion),
            keys: ['occasion'],
            customized: !!garment.preferences.occasion,
          },
          {
            id: 'climate',
            branchId: tab.id,
            kind: 'climate',
            label: 'Weather',
            value: lookupLabel(index, 'climate', garment.preferences.climate),
            keys: ['climate'],
            customized: !!garment.preferences.climate,
          },
          {
            id: 'fabric',
            branchId: tab.id,
            kind: 'fabric',
            label: 'Fabric',
            value: material?.name ?? NOT_CHOSEN,
            keys: ['material'],
            customized: confirmed.has('material'),
            swatch: material?.primaryHex,
          },
          ...tab.groups.map((item) => groupLeaf(index, item, tab.id)),
        ],
      });
      continue;
    }
    const leaves: OutlineLeaf[] = [];
    if (tab.include) {
      const link = product.components.find(
        (item) => item.componentCode === tab.include!.componentCode,
      );
      leaves.push({
        id: `include:${tab.include.componentCode}`,
        branchId: tab.id,
        kind: 'component',
        label: tab.include.label,
        value: tab.include.included ? 'Added' : 'Not added',
        keys: [],
        customized: tab.include.included !== !!link?.defaultIncluded,
        include: tab.include,
      });
    }
    leaves.push(
      ...tab.groups.map((item) =>
        groupLeaf(index, item, tab.id, tab.kind === 'accents' ? item.component.name : undefined),
      ),
    );
    branches.push({
      id: tab.id,
      label: tab.label,
      description:
        tab.kind === 'accents'
          ? 'Lining, monogram, buttons, threads and accessories'
          : (tab.component?.description ?? ''),
      leaves,
    });
  }
  return branches;
}

export function findLeaf(outline: OutlineBranch[], leafId: string) {
  for (const branch of outline) {
    const leaf = branch.leaves.find((item) => item.id === leafId);
    if (leaf) return leaf;
  }
  return undefined;
}

/**
 * Leaves, and their keys, whose values differ between two versions of the
 * same garment, in outline order (for chat suggestions and field edits alike).
 */
export function changedLeaves(index: RuntimeIndex, before: Garment, after: Garment) {
  if (before.productCode !== after.productCode) return [{ leafId: 'product', keys: ['product'] }];
  const was = effectiveSelections(index, before).selections;
  const now = effectiveSelections(index, after).selections;
  const included = (garment: Garment, code: string) => garment.includedComponents.includes(code);
  return designOutline(index, after).flatMap((branch) =>
    branch.leaves.flatMap((leaf) => {
      let keys: string[];
      if (leaf.kind === 'occasion' || leaf.kind === 'climate')
        keys = before.preferences[leaf.kind] !== after.preferences[leaf.kind] ? leaf.keys : [];
      else if (leaf.kind === 'fabric')
        keys = before.materialCode !== after.materialCode ? leaf.keys : [];
      else if (leaf.kind === 'component')
        keys =
          included(before, leaf.include!.componentCode) !==
          included(after, leaf.include!.componentCode)
            ? [leaf.include!.componentCode]
            : [];
      else if (leaf.kind === 'catalog') keys = leaf.keys.filter((key) => was[key] !== now[key]);
      else keys = [];
      return keys.length ? [{ leafId: leaf.id, keys }] : [];
    }),
  );
}

/** Fabrics offered for the garment's product, for the fabric editor. */
export function fabricChoices(index: RuntimeIndex, garment: Garment) {
  return materialsFor(index, garment.productCode);
}
