import type { RuntimeIndex, RuntimeMaterial } from './snapshot';
import { isSelectable, materialAllowed, type AvailabilityMap } from './garment';
import { basePrice } from '@/modules/pricing/quote';

// Customer fabric browsing (/fabrics). Reads only the published customer
// catalog, so drafts and supplier data never appear. A fabric is listed when at
// least one product offers it as the garment's own cloth.

export const FABRIC_CATEGORIES = [
  { code: 'suiting', label: 'Suiting', description: 'Cloth for suits, made to wear as a set.' },
  {
    code: 'jacketing',
    label: 'Jacketing',
    description: 'Character cloth for blazers and sport coats.',
  },
  { code: 'shirting', label: 'Shirting', description: 'Light, breathable cloth for shirts.' },
] as const;
export type FabricCategory = (typeof FABRIC_CATEGORIES)[number]['code'];

export type FabricFilters = {
  category?: string;
  colour?: string;
  pattern?: string;
  fibre?: string;
  season?: string;
  product?: string;
  band?: string;
};
export const FILTER_KEYS = [
  'category',
  'colour',
  'pattern',
  'fibre',
  'season',
  'product',
  'band',
] as const;

type Availability = AvailabilityMap;

/** Products that offer this fabric as the garment's cloth, in catalog order. */
export function fabricProducts(index: RuntimeIndex, material: RuntimeMaterial) {
  return index.catalog.products.filter((product) =>
    materialAllowed(index, product.code, material.code),
  );
}

export function fabricCategory(index: RuntimeIndex, material: RuntimeMaterial): FabricCategory {
  const products = fabricProducts(index, material).map((p) => p.visualModel);
  if (products.includes('shirt') && !products.includes('suit')) return 'shirting';
  if (products.includes('blazer') && !products.includes('suit')) return 'jacketing';
  return 'suiting';
}

/** The fibre with the largest share, used for filtering and card labels. */
export const mainFibre = (material: RuntimeMaterial) =>
  [...material.composition].sort((a, b) => b.percent - a.percent)[0]?.fibre ?? null;

export const lookupLabel = (index: RuntimeIndex, type: string, code: string | null) =>
  code ? (index.lookups.get(type)?.get(code)?.label ?? code.replaceAll('_', ' ')) : null;

export function compositionLabel(index: RuntimeIndex, material: RuntimeMaterial) {
  return material.composition
    .map((item) => `${item.percent}% ${lookupLabel(index, 'fibre', item.fibre)}`)
    .join(', ');
}

/** Lowest garment base price this fabric gives across the products it fits. */
export function fromPrice(index: RuntimeIndex, material: RuntimeMaterial) {
  const prices = fabricProducts(index, material)
    .map((product) => ({ product, price: basePrice(index, product, material.code) }))
    .filter((item) => item.price !== null)
    .sort((a, b) => a.price!.amountMinor - b.price!.amountMinor);
  const first = prices[0];
  return first ? { productName: first.product.name, amountMinor: first.price!.amountMinor } : null;
}

export function listableFabrics(index: RuntimeIndex) {
  return index.catalog.materials.filter((m) => fabricProducts(index, m).length > 0);
}

function matches(index: RuntimeIndex, m: RuntimeMaterial, f: FabricFilters) {
  return (
    (!f.category || fabricCategory(index, m) === f.category) &&
    (!f.colour || m.colourFamily === f.colour) &&
    (!f.pattern || m.pattern === f.pattern) &&
    (!f.fibre || mainFibre(m) === f.fibre) &&
    (!f.season || m.seasons.includes(f.season)) &&
    (!f.product || materialAllowed(index, f.product, m.code)) &&
    (!f.band || m.priceBand === f.band)
  );
}

/** Keeps only filter values the catalog knows, so a hand-edited URL cannot inject labels. */
export function parseFilters(raw: Record<string, string | string[] | undefined>): FabricFilters {
  const out: FabricFilters = {};
  for (const key of FILTER_KEYS) {
    const value = raw[key];
    if (typeof value === 'string' && /^[a-z0-9_.-]{1,180}$/i.test(value)) out[key] = value;
  }
  return out;
}

export type FacetOption = { code: string; label: string; count: number; hex?: string };

/** Filter options with counts, each counted with the other filters applied. */
export function fabricFacets(index: RuntimeIndex, filters: FabricFilters) {
  const all = listableFabrics(index);
  const facet = (
    key: keyof FabricFilters,
    values: (m: RuntimeMaterial) => (string | null)[],
    label: (code: string) => string,
  ): FacetOption[] => {
    const counts = new Map<string, number>();
    for (const m of all.filter((m) => matches(index, m, { ...filters, [key]: undefined })))
      for (const v of new Set(values(m))) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()]
      .map(([code, count]) => ({ code, count, label: label(code) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };
  const lookup = (type: string) => (code: string) => lookupLabel(index, type, code)!;
  const colours = facet('colour', (m) => [m.colourFamily], lookup('colour_family')).map((o) => ({
    ...o,
    hex: String(index.lookups.get('colour_family')?.get(o.code)?.metadata.hex ?? ''),
  }));
  const bandOrder = new Map(index.catalog.priceBands.map((b) => [b.code, b]));
  return {
    category: FABRIC_CATEGORIES.map((c) => ({
      code: c.code,
      label: c.label,
      count: all.filter((m) => matches(index, m, { ...filters, category: c.code })).length,
    })),
    colour: colours,
    pattern: facet('pattern', (m) => [m.pattern], lookup('pattern')),
    fibre: facet('fibre', (m) => [mainFibre(m)], lookup('fibre')),
    season: facet('season', (m) => m.seasons, lookup('season')),
    product: facet(
      'product',
      (m) => fabricProducts(index, m).map((p) => p.code),
      (code) => index.products.get(code)?.name ?? code,
    ),
    band: facet(
      'band',
      (m) => [m.priceBand],
      (code) => bandOrder.get(code)?.name ?? code,
    ).sort((a, b) => (bandOrder.get(a.code)?.sort ?? 0) - (bandOrder.get(b.code)?.sort ?? 0)),
  };
}

export function browseFabrics(
  index: RuntimeIndex,
  filters: FabricFilters,
  availability: Availability = {},
) {
  return listableFabrics(index)
    .filter((m) => matches(index, m, filters))
    .sort(
      (a, b) =>
        Number(isSelectable(availability[b.code])) - Number(isSelectable(availability[a.code])) ||
        (a.collection ?? '').localeCompare(b.collection ?? '') ||
        a.name.localeCompare(b.name),
    );
}

/** Up to `limit` fabrics sharing the colour family or collection, same category first. */
export function similarFabrics(index: RuntimeIndex, material: RuntimeMaterial, limit = 4) {
  const category = fabricCategory(index, material);
  const score = (m: RuntimeMaterial) =>
    Number(m.colourFamily === material.colourFamily) * 2 +
    Number(m.collection !== null && m.collection === material.collection) +
    Number(fabricCategory(index, m) === category);
  return listableFabrics(index)
    .filter((m) => m.code !== material.code)
    .map((m) => ({ m, s: score(m) }))
    .filter(({ s }) => s >= 2)
    .sort((a, b) => b.s - a.s || a.m.name.localeCompare(b.m.name))
    .slice(0, limit)
    .map(({ m }) => m);
}
