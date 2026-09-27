import seedJson from './suit-customization.seed.json';

export type SuitOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  selected: boolean;
  referencePrice: string | number | null;
  asset: string | null;
  attributes: Record<string, string>;
};
export type SuitSection = {
  id: string;
  label: string;
  field: string | null;
  selectionKey: string;
  note: string | null;
  order: number;
  options: SuitOption[];
};
export type SuitGroup = {
  id: string;
  label: string;
  shortLabel: string;
  order: number;
  shown: boolean;
  referenceMenuPrice: string | null;
  asset: string | null;
  sections: SuitSection[];
};
export type SuitCategory = {
  id: string;
  label: string;
  order: number;
  shown: boolean;
  groups: SuitGroup[];
};
export type SuitMenu = {
  id: 'style' | 'accents';
  label: string;
  sourceUrl: string;
  extractedAt: string;
  note: string;
  categories: SuitCategory[];
};
export type SuitCustomizationSeed = {
  id: string;
  version: number;
  product: 'suit';
  sourceKind: string;
  commercialStatus: string;
  priceStatus: string;
  assetRightsStatus: string;
  optionCount: number;
  menus: SuitMenu[];
};

export const SUIT_CUSTOMIZATION_SEED = seedJson as SuitCustomizationSeed;
const sections = SUIT_CUSTOMIZATION_SEED.menus.flatMap((menu) =>
  menu.categories.flatMap((category) => category.groups.flatMap((group) => group.sections)),
);
const sectionsByKey = new Map(sections.map((section) => [section.selectionKey, section]));

export function defaultSuitCustomizations() {
  return Object.fromEntries(
    sections.flatMap((section) => {
      const selected = section.options.find((option) => option.selected);
      return selected ? [[section.selectionKey, selected.value]] : [];
    }),
  );
}

export function validateSuitCustomizations(values: Record<string, string>) {
  for (const [selectionKey, value] of Object.entries(values)) {
    const section = sectionsByKey.get(selectionKey);
    if (!section || !section.options.some((option) => option.value === value)) return false;
  }
  return true;
}

export function optionFor(selectionKey: string, value?: string) {
  return value
    ? sectionsByKey.get(selectionKey)?.options.find((option) => option.value === value)
    : undefined;
}

export function legacyDesignForSuit(values: Record<string, string>) {
  const result: {
    fit?: 'Tailored' | 'Classic';
    lapel?: 'Notch' | 'Peak';
    pockets?: 'Flap' | 'Patch';
    closure?: 'One button' | 'Two buttons';
  } = {};
  const fit = values['style.jacket.jacket_fit.jacket-fit'];
  if (fit === '1') result.fit = 'Tailored';
  if (fit === '0') result.fit = 'Classic';
  const lapel = values['style.jacket.jacket_lapel_type_combinated.jacket-lapel-type'];
  if (lapel === 'standard') result.lapel = 'Notch';
  if (lapel === 'peak') result.lapel = 'Peak';
  const pockets = values['style.jacket.jacket_pockets_type.jacket-pockets-type'];
  if (pockets === '2b') result.pockets = 'Patch';
  if (pockets && pockets !== '2b') result.pockets = 'Flap';
  const style = values['style.jacket.jacket_style_combined.jacket-style-combined'];
  if (style === 'simple_1') result.closure = 'One button';
  if (style === 'simple_2') result.closure = 'Two buttons';
  return result;
}

export function suitCustomizationsForLegacyDesign(values: {
  fit?: string;
  lapel?: string;
  pockets?: string;
  closure?: string;
}) {
  const result: Record<string, string> = {};
  if (values.fit === 'Tailored') result['style.jacket.jacket_fit.jacket-fit'] = '1';
  if (values.fit === 'Classic') result['style.jacket.jacket_fit.jacket-fit'] = '0';
  if (values.lapel === 'Notch')
    result['style.jacket.jacket_lapel_type_combinated.jacket-lapel-type'] = 'standard';
  if (values.lapel === 'Peak')
    result['style.jacket.jacket_lapel_type_combinated.jacket-lapel-type'] = 'peak';
  if (values.pockets === 'Patch')
    result['style.jacket.jacket_pockets_type.jacket-pockets-type'] = '2b';
  if (values.pockets === 'Flap')
    result['style.jacket.jacket_pockets_type.jacket-pockets-type'] = '2';
  if (values.closure === 'One button')
    result['style.jacket.jacket_style_combined.jacket-style-combined'] = 'simple_1';
  if (values.closure === 'Two buttons')
    result['style.jacket.jacket_style_combined.jacket-style-combined'] = 'simple_2';
  return result;
}

export function hasVest(values: Record<string, string>) {
  return values['style.vest.waistcoat.waistcoat'] === '1';
}
