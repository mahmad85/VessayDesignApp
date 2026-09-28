import { createHash } from 'node:crypto';
import { FABRICS, PRODUCTS, type Fabric, type Product } from './catalog';
import {
  SUIT_CUSTOMIZATION_SEED,
  type SuitCustomizationSeed,
  type SuitGroup,
  type SuitSection,
} from './suit-customization';
import {
  IMPORTED_EXTRA_VALUES,
  LEGACY_CLIMATES,
  LEGACY_COLLAR,
  LEGACY_CUFFS,
  LEGACY_KEYS,
  LEGACY_SHIRT_FIT,
} from './legacy-mapping';
import { LOOKUP_TYPES, LOOKUP_VALUES, type LookupTypeSeed } from './lookup-seeds';
import { referenceSwatchAlt, referenceSwatchPath } from './reference-swatches';
import {
  normalizeSnapshot,
  parseSnapshot,
  valueKey,
  type CatalogSnapshot,
  type MetadataField,
  type SnapshotAttribute,
  type SnapshotComponent,
  type SnapshotGroup,
  type SnapshotMaterial,
  type SnapshotMedia,
  type SnapshotProduct,
  type SnapshotValue,
} from './snapshot';
import type { Condition } from './conditions';
import { OFF_VALUES, cleanOptionLabel, readableLabel } from '../configuration/design-outline';
import { LEAF_REGIONS } from '@/visualization/focus-regions';
import { slotForKey } from '@/visualization/registry';

// Legacy importer (CATALOG-ADMIN.md §10, TASK-015 step 5). A pure,
// deterministic function from today's code and seed data to a CatalogSnapshot:
// running it twice gives the same codes, ids and checksum. Everything imported
// is reference-only (D-012, D-014, Q-011, Q-023): no prices, no supplier facts,
// no invented fabric numbers.
//
// Archived import entities are represented by their absence, because a
// snapshot holds active rows only: the placeholder groups whose label equals
// their id (pants_chinos, waistcoat_wedding) and the waistcoat on/off option,
// which becomes inclusion of the `vest` component. The waistcoat group itself
// stays active (with no options) so its leaf keeps its 2D focus and 3D
// coverage for the component toggle.

export type LegacySources = {
  seed: SuitCustomizationSeed;
  fabrics: readonly Fabric[];
  products: Record<Product, { name: string; label: string; description: string }>;
};
export const LEGACY_SOURCES: LegacySources = {
  seed: SUIT_CUSTOMIZATION_SEED,
  fabrics: FABRICS,
  products: PRODUCTS,
};
export type LegacyImport = { snapshot: CatalogSnapshot; lookupTypes: LookupTypeSeed[] };

/** Commerce defaults of migration 0003 (Q-019 development placeholders). */
export const DEFAULT_COMMERCE = {
  currency: 'USD',
  settings: {
    shippingFlatMinor: 0,
    quoteTtlMinutes: 10080,
    orderNumberPrefix: 'VS',
    shipCountries: ['US'],
  },
} as const;

const ACCESSORY_GROUPS = new Set([
  'accents.jacket.panuelos',
  'accents.jacket.bowtie',
  'accents.jacket.tie',
  'accents.jacket.suspenders',
  'accents.jacket.shoes',
  'accents.pants.belt',
  'accents.pants.socks',
]);
const COMPONENT_OF_CATEGORY: Record<string, string> = {
  jacket: 'jacket',
  pants: 'trousers',
  vest: 'vest',
};
const COMPONENTS = [
  ['jacket', 'Jacket', 'Style, lapels, pockets, sleeves and back', 'jacket'],
  ['trousers', 'Trousers', 'Fit, length, pleats, fastening and pockets', 'trousers'],
  ['vest', 'Vest', 'Add a waistcoat and shape its details', 'vest'],
  ['shirt', 'Shirt', 'Fit, collar and cuffs', 'shirt'],
] as const;
/** Blazer keeps only these jacket choices until an admin enables more (CAT-002). */
const BLAZER_AVAILABLE: Record<string, readonly string[] | 'all'> = {
  [LEGACY_KEYS.jacketStyle]: ['simple_1', 'simple_2'],
  [LEGACY_KEYS.lapelType]: ['standard', 'peak'],
  [LEGACY_KEYS.pocketsType]: ['2', '2b'],
  [LEGACY_KEYS.jacketFit]: 'all',
};
const FABRIC_PATTERN: Record<Fabric['pattern'], string> = {
  plain: 'solid',
  twill: 'twill',
  check: 'windowpane',
  stripe: 'pinstripe',
};
const CONTENT_TYPES: Record<string, SnapshotMedia['contentType']> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

const NAMESPACE = Buffer.from('6f1b2c3d4e5f40718293a4b5c6d7e8f9', 'hex');
/** Name-based (UUID v5 layout) id, so re-importing yields the same media ids. */
export function nameBasedId(name: string) {
  const hash = createHash('sha1').update(NAMESPACE).update(name, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Choice metadata keys: source prices move under `source*`, which the customer projection strips. */
function metadataKey(key: string) {
  const price = /^price_(.+)$/.exec(key);
  if (!price) return key;
  return `sourcePrice${price[1].charAt(0).toUpperCase()}${price[1].slice(1).replace(/_(\w)/g, (_, c: string) => c.toUpperCase())}`;
}
const humanize = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

/** The first section of a group gates the others (design-outline.ts#relevantSections). */
function gate(group: SuitGroup): Condition | null {
  const [first, ...rest] = group.sections;
  if (!first || !rest.length) return null;
  if (first.options.some((option) => option.value === 'personalizado'))
    return { attr: first.selectionKey, in: ['personalizado'] };
  const off = first.options.find((option) => OFF_VALUES.has(option.value));
  return off ? { not: { attr: first.selectionKey, in: [off.value] } } : null;
}

export function importLegacyCatalog(sources: LegacySources = LEGACY_SOURCES): LegacyImport {
  const media = new Map<string, SnapshotMedia>();
  const addMedia = (
    key: string | null,
    alt: string,
    rightsStatus: SnapshotMedia['rightsStatus'] = 'reference_only',
  ) => {
    if (!key) return null;
    const id = nameBasedId(`static:${key}`);
    if (!media.has(id)) {
      const contentType = CONTENT_TYPES[key.split('.').pop()!.toLowerCase()];
      if (!contentType) throw new Error(`Unsupported reference asset type: ${key}`);
      media.set(id, { id, url: key, contentType, width: null, height: null, alt, rightsStatus });
    }
    return id;
  };

  const value = (
    code: string,
    label: string,
    sort: number,
    slot: string | null,
    extra: Partial<SnapshotValue> = {},
  ): SnapshotValue => ({
    code,
    label,
    description: '',
    imageMediaId: null,
    surchargeMinor: 0,
    supplierCode: null,
    visualToken: slot ? code : null,
    isOff: OFF_VALUES.has(code),
    sort,
    metadata: {},
    referenceOnly: true,
    ...extra,
  });

  const attributeFromSection = (section: SuitSection, visibleWhen: Condition | null) => {
    const slot = slotForKey(section.selectionKey) ?? null;
    const metadataFields: MetadataField[] = [];
    const values = section.options.map((option) => {
      const metadata: Record<string, string> = { sourceLabel: option.label };
      if (option.referencePrice !== null) metadata.referencePrice = String(option.referencePrice);
      for (const [key, raw] of Object.entries(option.attributes ?? {})) {
        if (raw === '') continue;
        const target = metadataKey(key);
        metadata[target] = raw;
        if (target === key && !metadataFields.some((field) => field.key === key))
          metadataFields.push({
            key,
            label: humanize(key),
            type: 'text',
            lookupType: null,
            required: false,
          });
      }
      const label = cleanOptionLabel(option.label);
      return value(option.value, label, option.order, slot, {
        imageMediaId: addMedia(option.asset, label),
        metadata,
      });
    });
    const extra = IMPORTED_EXTRA_VALUES[section.selectionKey] ?? [];
    const maxSort = Math.max(0, ...values.map((item) => item.sort));
    extra.forEach((code, i) =>
      values.push(value(code, cleanOptionLabel(code), maxSort + 1 + i, slot)),
    );
    return {
      code: section.selectionKey,
      name: readableLabel(section.label),
      helpText: section.note ?? '',
      inputType: 'choice',
      required: true,
      textRules: null,
      visualSlot: slot,
      surchargeMinor: 0,
      visibleWhen,
      sort: section.order,
      metadataFields,
      defaultValueCode: section.options.find((option) => option.selected)?.value ?? null,
      referenceOnly: true,
      legacyKey: section.selectionKey,
      values,
    } satisfies SnapshotAttribute;
  };

  // Seed menus → groups of the jacket, trousers and vest components.
  const groupsByComponent = new Map<string, SnapshotGroup[]>(
    COMPONENTS.map(([code]) => [code, []]),
  );
  let vestReferencePrice: string | null = null;
  for (const menu of sources.seed.menus)
    for (const category of menu.categories)
      for (const group of category.groups) {
        if (group.label === group.id) continue;
        const code = `${menu.id}.${category.id}.${group.id}`;
        const opening = gate(group);
        const attributes = group.sections.flatMap((section, index) => {
          if (section.selectionKey === LEGACY_KEYS.vest) {
            const on = section.options.find((option) => option.value === '1');
            vestReferencePrice = on?.referencePrice == null ? null : String(on.referencePrice);
            return [];
          }
          return [attributeFromSection(section, index > 0 ? opening : null)];
        });
        const name = readableLabel(group.label);
        groupsByComponent.get(COMPONENT_OF_CATEGORY[category.id])!.push({
          code,
          name,
          shortName: readableLabel(group.shortLabel),
          description: '',
          kind: menu.id === 'style' ? 'style' : 'accent',
          lineKind: ACCESSORY_GROUPS.has(code) ? 'accessory' : 'construction',
          iconMediaId: addMedia(group.asset, name),
          focusRegion: LEAF_REGIONS[code] ?? '',
          surchargeMinor: 0,
          visibleWhen:
            category.id === 'vest' && code !== 'style.vest.waistcoat'
              ? { component: 'vest', included: true }
              : null,
          sort: menu.id === 'style' ? group.order : 100 + group.order,
          referenceOnly: true,
          metadata: group.referenceMenuPrice
            ? { referenceMenuPrice: group.referenceMenuPrice }
            : {},
          attributes,
        });
      }

  // Legacy shirt fields → the shirt component (seed naming pattern).
  const shirtGroup = (
    id: string,
    name: string,
    focusRegion: string,
    sort: number,
    key: string,
    choices: Record<string, string>,
  ): SnapshotGroup => {
    const slot = slotForKey(key) ?? null;
    const values = Object.entries(choices).map(([label, code], i) =>
      value(code, label, i + 1, slot),
    );
    return {
      code: `style.shirt.${id}`,
      name,
      shortName: name,
      description: '',
      kind: 'style',
      lineKind: 'construction',
      iconMediaId: null,
      focusRegion,
      surchargeMinor: 0,
      visibleWhen: null,
      sort,
      referenceOnly: true,
      metadata: {},
      attributes: [
        {
          code: key,
          name,
          helpText: '',
          inputType: 'choice',
          required: true,
          textRules: null,
          visualSlot: slot,
          surchargeMinor: 0,
          visibleWhen: null,
          sort: 1,
          metadataFields: [],
          defaultValueCode: values[0].code,
          referenceOnly: true,
          legacyKey: null,
          values,
        },
      ],
    };
  };
  groupsByComponent.set('shirt', [
    shirtGroup('shirt_fit', 'Fit', 'torso', 1, LEGACY_KEYS.shirtFit, LEGACY_SHIRT_FIT),
    shirtGroup('shirt_collar', 'Collar', 'collar', 2, LEGACY_KEYS.shirtCollar, LEGACY_COLLAR),
    shirtGroup('shirt_cuffs', 'Cuffs', 'sleeve', 3, LEGACY_KEYS.shirtCuffs, LEGACY_CUFFS),
  ]);

  const components: SnapshotComponent[] = COMPONENTS.map(
    ([code, name, description, visualPart], i) => ({
      code,
      name,
      description,
      visualPart,
      sort: i + 1,
      referenceOnly: true,
      groups: groupsByComponent.get(code)!,
    }),
  );

  // Blazer: the shared jacket, restricted to today's blazer choices.
  const jacketGroups = groupsByComponent.get('jacket')!;
  const blazerSettings: SnapshotProduct['settings'] = { groups: {}, attributes: {}, values: {} };
  for (const group of jacketGroups) {
    const kept = group.attributes.filter((attribute) => attribute.code in BLAZER_AVAILABLE);
    if (!kept.length) {
      blazerSettings.groups[group.code] = { available: false, surchargeOverrideMinor: null };
      continue;
    }
    for (const attribute of group.attributes) {
      const allowed = BLAZER_AVAILABLE[attribute.code];
      if (!allowed) {
        blazerSettings.attributes[attribute.code] = {
          available: false,
          defaultValueCode: null,
          surchargeOverrideMinor: null,
        };
        continue;
      }
      if (allowed === 'all') continue;
      for (const item of attribute.values)
        if (!allowed.includes(item.code))
          blazerSettings.values[valueKey(attribute.code, item.code)] = {
            available: false,
            surchargeOverrideMinor: null,
          };
    }
  }
  const noSettings = (): SnapshotProduct['settings'] => ({
    groups: {},
    attributes: {},
    values: {},
  });
  const link = (
    componentCode: string,
    sort: number,
    optional?: { includeLabel: string; metadata: Record<string, string> },
  ) => ({
    componentCode,
    required: !optional,
    defaultIncluded: !optional,
    surchargeMinor: 0,
    includeLabel: optional?.includeLabel ?? null,
    sort,
    metadata: optional?.metadata ?? {},
  });
  const product = (
    code: Product,
    sort: number,
    defaultMaterialCode: string,
    links: SnapshotProduct['components'],
    settings = noSettings(),
  ): SnapshotProduct => ({
    code,
    name: sources.products[code].name,
    shortLabel: sources.products[code].label,
    description: sources.products[code].description,
    sort,
    heroMediaId: null,
    measurementSet: code,
    visualModel: code,
    defaultMaterialCode,
    referenceOnly: true,
    components: links,
    bandPrices: {},
    settings,
  });
  const defaultFabric = (code: Product) =>
    sources.fabrics.find((fabric) => fabric.products.includes(code))!.id;
  const products = [
    product('suit', 1, defaultFabric('suit'), [
      link('jacket', 1),
      link('trousers', 2),
      link('vest', 3, {
        includeLabel: 'Add a vest',
        metadata: vestReferencePrice === null ? {} : { referencePrice: vestReferencePrice },
      }),
    ]),
    product('shirt', 2, defaultFabric('shirt'), [link('shirt', 1)]),
    product('blazer', 3, defaultFabric('blazer'), [link('jacket', 1)], blazerSettings),
  ];

  const renderPatternOf = new Map(
    LOOKUP_VALUES.pattern.map((item) => [item.code, item.metadata!.renderPattern]),
  );
  const climateCode = LEGACY_CLIMATES as Record<string, string>;
  const materials = sources.fabrics.map((fabric): SnapshotMaterial => {
    const pattern = FABRIC_PATTERN[fabric.pattern];
    const swatch = addMedia(referenceSwatchPath(fabric.id), referenceSwatchAlt(fabric), 'owned')!;
    return {
      code: fabric.id,
      name: fabric.name,
      colourName: fabric.name,
      colourFamily: null,
      primaryHex: fabric.color,
      secondaryHex: null,
      pattern,
      renderPattern: renderPatternOf.get(pattern) as SnapshotMaterial['renderPattern'],
      weave: null,
      texture: null,
      sheen: null,
      finishes: [],
      composition: [],
      weightGsm: null,
      superNumber: null,
      yarnCount: null,
      widthCm: null,
      stretch: null,
      seasons: [],
      climates: fabric.climates.map((label) => {
        const code = climateCode[label];
        if (!code) throw new Error(`Unknown reference climate: ${label}`);
        return code;
      }),
      occasions: [],
      formality: null,
      wrinkleResistance: null,
      breathability: null,
      opacity: null,
      drape: null,
      care: [],
      descriptionShort: fabric.description,
      story: '',
      tags: [],
      usages: fabric.products.includes('shirt') ? ['shirting'] : ['shell'],
      productCodes: [...fabric.products],
      priceBand: null,
      priceOverrides: {},
      media: [{ mediaId: swatch, role: 'swatch', sort: 0 }],
      textureScaleCm: null,
      metadata: {
        weightLabel: fabric.weight,
        compositionLabel: fabric.composition,
        toneLabel: fabric.tone,
      },
      referenceOnly: true,
      supplier: null,
      millName: null,
      displayMillName: false,
      collection: null,
      seasonCode: null,
    };
  });

  const lookups = Object.fromEntries(
    LOOKUP_TYPES.map((type) => [
      type.code,
      (LOOKUP_VALUES[type.code] ?? []).map((item, i) => ({
        code: item.code,
        label: item.label,
        description: '',
        sort: i + 1,
        metadata: item.metadata ?? {},
      })),
    ]),
  );

  const snapshot = normalizeSnapshot({
    schemaVersion: 1,
    version: 0,
    publishedAt: '',
    referenceOnly: true,
    currency: DEFAULT_COMMERCE.currency,
    settings: {
      ...DEFAULT_COMMERCE.settings,
      shipCountries: [...DEFAULT_COMMERCE.settings.shipCountries],
    },
    lookups,
    priceBands: [],
    media: Object.fromEntries(media),
    components,
    products,
    materials,
    rules: [],
    templates: [],
  });
  return { snapshot: parseSnapshot(snapshot), lookupTypes: LOOKUP_TYPES };
}
