import { z } from 'zod';
import { MAX_MINOR } from '@/lib/money';
import { conditionSchema } from './conditions';

// The catalog release contract (ADMIN-BACKEND.md §5). A CatalogSnapshot is the
// compiled, immutable content of one release. The CustomerCatalog is its
// public projection (CATALOG-ADMIN.md §9). Both are validated whenever a
// release is loaded.
//
// Internal fields beyond §5, stripped from the customer projection:
// groups[].metadata, products[].components[].metadata, attributes[].legacyKey
// and rules[].name. They carry import provenance (CATALOG-ADMIN.md §10) and
// the admin rule name through the snapshot → working copy round trip.

export const CATALOG_CODE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
export const VALUE_CODE = /^[A-Za-z0-9](?:[A-Za-z0-9 _.-]{0,78}[A-Za-z0-9])?$/;
export const TEMPLATE_CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const BAND_CODE = /^[A-Z0-9]{1,8}$/;

export const codeSchema = z.string().min(1).max(180).regex(CATALOG_CODE);
export const valueCodeSchema = z.string().regex(VALUE_CODE);
const templateCode = z.string().max(180).regex(TEMPLATE_CODE);
const bandCode = z.string().regex(BAND_CODE);
const minor = z.number().int().min(0).max(MAX_MINOR);
const text = (max = 2000) => z.string().max(max);
const metadata = z.record(
  z.string().min(1).max(80),
  z.union([z.string().max(2000), z.number().finite(), z.boolean()]),
);
const nullableCondition = conditionSchema.nullable();

export const VISUAL_PARTS = ['jacket', 'trousers', 'vest', 'shirt'] as const;
export const VISUAL_MODELS = ['suit', 'shirt', 'blazer'] as const;
export const MEASUREMENT_SETS = ['suit', 'shirt', 'blazer'] as const;
export const MEDIA_ROLES = ['swatch', 'texture', 'closeup', 'drape', 'garment'] as const;
export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] as const;
export const RIGHTS_STATUSES = [
  'owned',
  'licensed',
  'supplier_provided',
  'reference_only',
  'unknown',
] as const;
export const USAGES = ['shell', 'lining', 'contrast', 'shirting'] as const;
export const RENDER_PATTERNS = ['plain', 'twill', 'check', 'stripe'] as const;
const level = z.enum(['low', 'medium', 'high']).nullable();

const mediaSchema = z.strictObject({
  id: z.string().min(1).max(64),
  url: z.string().min(1).max(500),
  contentType: z.enum(MEDIA_TYPES),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  alt: text(500),
  rightsStatus: z.enum(RIGHTS_STATUSES),
});

const textRulesSchema = z.strictObject({
  maxLength: z.number().int().min(1).max(60),
  pattern: z.string().max(200).nullable(),
  transform: z.enum(['none', 'upper']),
  placeholder: text(120),
});
const metadataFieldSchema = z.strictObject({
  key: z.string().min(1).max(80),
  label: text(120),
  type: z.enum(['lookup', 'text', 'number', 'boolean']),
  lookupType: codeSchema.nullable(),
  required: z.boolean(),
});

const valueSchema = z.strictObject({
  code: valueCodeSchema,
  label: text(200),
  description: text(),
  imageMediaId: z.string().nullable(),
  surchargeMinor: minor,
  supplierCode: z.string().max(120).nullable(),
  visualToken: z.string().max(120).nullable(),
  isOff: z.boolean(),
  sort: z.number().int(),
  metadata,
  referenceOnly: z.boolean(),
});
const attributeSchema = z.strictObject({
  code: codeSchema,
  name: text(200),
  helpText: text(),
  inputType: z.enum(['choice', 'text']),
  required: z.boolean(),
  textRules: textRulesSchema.nullable(),
  visualSlot: z.string().max(120).nullable(),
  surchargeMinor: minor,
  visibleWhen: nullableCondition,
  sort: z.number().int(),
  metadataFields: z.array(metadataFieldSchema).max(30),
  defaultValueCode: valueCodeSchema.nullable(),
  referenceOnly: z.boolean(),
  legacyKey: z.string().max(180).nullable(),
  values: z.array(valueSchema),
});
const groupSchema = z.strictObject({
  code: codeSchema,
  name: text(200),
  shortName: text(120),
  description: text(),
  kind: z.enum(['style', 'accent']),
  lineKind: z.enum(['construction', 'accessory']),
  iconMediaId: z.string().nullable(),
  focusRegion: z.string().max(60),
  surchargeMinor: minor,
  visibleWhen: nullableCondition,
  sort: z.number().int(),
  referenceOnly: z.boolean(),
  metadata,
  attributes: z.array(attributeSchema),
});
const componentSchema = z.strictObject({
  code: codeSchema,
  name: text(200),
  description: text(),
  visualPart: z.enum(VISUAL_PARTS),
  sort: z.number().int(),
  referenceOnly: z.boolean(),
  groups: z.array(groupSchema),
});
const productComponentSchema = z.strictObject({
  componentCode: codeSchema,
  required: z.boolean(),
  defaultIncluded: z.boolean(),
  surchargeMinor: minor,
  includeLabel: text(120).nullable(),
  sort: z.number().int(),
  metadata,
});
const productSchema = z.strictObject({
  code: codeSchema,
  name: text(200),
  shortLabel: text(80),
  description: text(),
  sort: z.number().int(),
  heroMediaId: z.string().nullable(),
  measurementSet: z.enum(MEASUREMENT_SETS),
  visualModel: z.enum(VISUAL_MODELS),
  defaultMaterialCode: z.string().max(180),
  referenceOnly: z.boolean(),
  components: z.array(productComponentSchema),
  bandPrices: z.record(bandCode, minor),
  settings: z.strictObject({
    groups: z.record(
      z.string(),
      z.strictObject({ available: z.boolean(), surchargeOverrideMinor: minor.nullable() }),
    ),
    attributes: z.record(
      z.string(),
      z.strictObject({
        available: z.boolean(),
        defaultValueCode: valueCodeSchema.nullable(),
        surchargeOverrideMinor: minor.nullable(),
      }),
    ),
    values: z.record(
      z.string(),
      z.strictObject({ available: z.boolean(), surchargeOverrideMinor: minor.nullable() }),
    ),
  }),
});
const materialSchema = z.strictObject({
  code: codeSchema,
  name: text(200),
  colourName: text(120).nullable(),
  colourFamily: codeSchema.nullable(),
  primaryHex: z.string().regex(/^(#[0-9a-fA-F]{6})?$/),
  secondaryHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  pattern: z.string().max(180),
  renderPattern: z.enum(RENDER_PATTERNS),
  weave: codeSchema.nullable(),
  texture: codeSchema.nullable(),
  sheen: codeSchema.nullable(),
  finishes: z.array(codeSchema),
  composition: z.array(
    z.strictObject({ fibre: codeSchema, percent: z.number().int().min(1).max(100) }),
  ),
  weightGsm: z.number().int().nullable(),
  superNumber: z.number().int().nullable(),
  yarnCount: text(40).nullable(),
  widthCm: z.number().int().nullable(),
  stretch: codeSchema.nullable(),
  seasons: z.array(codeSchema),
  climates: z.array(codeSchema),
  occasions: z.array(codeSchema),
  formality: z.number().int().min(1).max(5).nullable(),
  wrinkleResistance: level,
  breathability: level,
  opacity: level,
  drape: z.enum(['fluid', 'balanced', 'structured']).nullable(),
  care: z.array(codeSchema),
  descriptionShort: text(160),
  story: text(2000),
  tags: z.array(codeSchema),
  usages: z.array(z.enum(USAGES)),
  productCodes: z.array(codeSchema),
  priceBand: bandCode.nullable(),
  priceOverrides: z.record(codeSchema, minor),
  media: z.array(
    z.strictObject({
      mediaId: z.string().min(1),
      role: z.enum(MEDIA_ROLES),
      sort: z.number().int(),
    }),
  ),
  textureScaleCm: z.number().positive().nullable(),
  metadata,
  referenceOnly: z.boolean(),
  supplier: z
    .strictObject({ id: z.string(), name: text(200), articleCode: z.string().nullable() })
    .nullable(),
  millName: text(200).nullable(),
  displayMillName: z.boolean(),
  collection: text(200).nullable(),
  seasonCode: text(40).nullable(),
});
const ruleSchema = z.strictObject({
  code: codeSchema,
  name: text(200),
  productCodes: z.array(codeSchema),
  when: conditionSchema,
  effect: z.enum(['forbid', 'require']),
  attributeCode: codeSchema,
  valueCodes: z.array(valueCodeSchema).min(1),
  message: text(500),
});
const templateSchema = z.strictObject({
  code: templateCode,
  productCode: codeSchema,
  name: text(200),
  subtitle: text(200),
  description: text(),
  story: text(2000),
  materialCode: codeSchema,
  includedComponents: z.array(codeSchema),
  selections: z.record(codeSchema, z.string().max(180)),
  occasions: z.array(codeSchema),
  climates: z.array(codeSchema),
  featured: z.boolean(),
  sort: z.number().int(),
  heroMediaId: z.string().nullable(),
  galleryMediaIds: z.array(z.string()).max(8),
  asShownPriceMinor: minor.nullable(),
  referenceOnly: z.boolean(),
});
const lookupValueSchema = z.strictObject({
  code: codeSchema,
  label: text(200),
  description: text(),
  sort: z.number().int(),
  metadata: z.record(z.string(), z.unknown()),
});

export const catalogSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  version: z.number().int().min(0),
  /** ISO timestamp once published; empty for an unpublished compile or import. */
  publishedAt: z.string(),
  referenceOnly: z.boolean(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  settings: z.strictObject({
    shippingFlatMinor: minor,
    quoteTtlMinutes: z.number().int().min(60).max(43200),
    orderNumberPrefix: z.string().regex(/^[A-Z]{2,4}$/),
    shipCountries: z.array(z.string().regex(/^[A-Z]{2}$/)),
  }),
  lookups: z.record(codeSchema, z.array(lookupValueSchema)),
  priceBands: z.array(z.strictObject({ code: bandCode, name: text(120), sort: z.number().int() })),
  media: z.record(z.string(), mediaSchema),
  components: z.array(componentSchema),
  products: z.array(productSchema),
  materials: z.array(materialSchema),
  rules: z.array(ruleSchema),
  templates: z.array(templateSchema),
});

export type CatalogSnapshot = z.infer<typeof catalogSnapshotSchema>;
export type SnapshotMedia = z.infer<typeof mediaSchema>;
export type SnapshotComponent = z.infer<typeof componentSchema>;
export type SnapshotGroup = z.infer<typeof groupSchema>;
export type SnapshotAttribute = z.infer<typeof attributeSchema>;
export type SnapshotValue = z.infer<typeof valueSchema>;
export type SnapshotProduct = z.infer<typeof productSchema>;
export type SnapshotProductComponent = z.infer<typeof productComponentSchema>;
export type SnapshotMaterial = z.infer<typeof materialSchema>;
export type SnapshotRule = z.infer<typeof ruleSchema>;
export type SnapshotTemplate = z.infer<typeof templateSchema>;
export type SnapshotLookupValue = z.infer<typeof lookupValueSchema>;
export type MetadataField = z.infer<typeof metadataFieldSchema>;
export type TextRules = z.infer<typeof textRulesSchema>;

// Customer projection: the same shape without internal fields (CATALOG-ADMIN §9).
const customerValueSchema = valueSchema.omit({ supplierCode: true });
const customerAttributeSchema = attributeSchema
  .omit({ legacyKey: true, values: true })
  .extend({ values: z.array(customerValueSchema) });
const customerGroupSchema = groupSchema
  .omit({ metadata: true, attributes: true })
  .extend({ attributes: z.array(customerAttributeSchema) });
const customerComponentSchema = componentSchema
  .omit({ groups: true })
  .extend({ groups: z.array(customerGroupSchema) });
const customerProductSchema = productSchema
  .omit({ components: true })
  .extend({ components: z.array(productComponentSchema.omit({ metadata: true })) });
const customerMaterialSchema = materialSchema.extend({ supplier: z.null() });
export const customerCatalogSchema = catalogSnapshotSchema
  .omit({ media: true, components: true, products: true, materials: true, rules: true })
  .extend({
    media: z.record(z.string(), mediaSchema.omit({ rightsStatus: true })),
    components: z.array(customerComponentSchema),
    products: z.array(customerProductSchema),
    materials: z.array(customerMaterialSchema),
    rules: z.array(ruleSchema.omit({ name: true })),
  });
export type CustomerCatalog = z.infer<typeof customerCatalogSchema>;

export function parseSnapshot(input: unknown): CatalogSnapshot {
  return catalogSnapshotSchema.parse(input);
}

/** Key of a choice within a product's settings and the catalog index. */
export const valueKey = (attributeCode: string, valueCode: string) =>
  `${attributeCode}::${valueCode}`;

const bySortThenCode = <T extends { sort: number; code: string }>(a: T, b: T) =>
  a.sort - b.sort || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
const byCode = <T extends { code: string }>(a: T, b: T) =>
  a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
const sorted = (codes: readonly string[]) => [...codes].sort();

/**
 * Canonical array order: entities by sort then code, code sets alphabetically.
 * The compiler and the importer both apply it, so equal content has an equal checksum.
 * Rule order is kept as compiled (sort, then code, in the working tables).
 */
export function normalizeSnapshot(snapshot: CatalogSnapshot): CatalogSnapshot {
  return {
    ...snapshot,
    settings: { ...snapshot.settings, shipCountries: sorted(snapshot.settings.shipCountries) },
    lookups: Object.fromEntries(
      Object.entries(snapshot.lookups).map(([type, values]) => [
        type,
        [...values].sort(bySortThenCode),
      ]),
    ),
    priceBands: [...snapshot.priceBands].sort(bySortThenCode),
    components: [...snapshot.components].sort(bySortThenCode).map((component) => ({
      ...component,
      groups: [...component.groups].sort(bySortThenCode).map((group) => ({
        ...group,
        attributes: [...group.attributes].sort(bySortThenCode).map((attribute) => ({
          ...attribute,
          values: [...attribute.values].sort(bySortThenCode),
        })),
      })),
    })),
    products: [...snapshot.products].sort(bySortThenCode).map((product) => ({
      ...product,
      components: [...product.components].sort(
        (a, b) =>
          a.sort - b.sort ||
          (a.componentCode < b.componentCode ? -1 : a.componentCode > b.componentCode ? 1 : 0),
      ),
    })),
    materials: [...snapshot.materials].sort(byCode).map((material) => ({
      ...material,
      finishes: sorted(material.finishes),
      seasons: sorted(material.seasons),
      climates: sorted(material.climates),
      occasions: sorted(material.occasions),
      care: sorted(material.care),
      tags: sorted(material.tags),
      usages: [...material.usages].sort(),
      productCodes: sorted(material.productCodes),
      media: [...material.media].sort(
        (a, b) =>
          a.sort - b.sort ||
          (a.role < b.role ? -1 : a.role > b.role ? 1 : 0) ||
          (a.mediaId < b.mediaId ? -1 : a.mediaId > b.mediaId ? 1 : 0),
      ),
    })),
    rules: snapshot.rules.map((rule) => ({
      ...rule,
      productCodes: sorted(rule.productCodes),
      valueCodes: sorted(rule.valueCodes),
    })),
    templates: [...snapshot.templates].sort(bySortThenCode).map((template) => ({
      ...template,
      includedComponents: sorted(template.includedComponents),
      occasions: sorted(template.occasions),
      climates: sorted(template.climates),
    })),
  };
}

export type IndexedGroup = { group: SnapshotGroup; component: SnapshotComponent };
export type IndexedAttribute = IndexedGroup & { attribute: SnapshotAttribute };
export type IndexedValue = IndexedAttribute & { value: SnapshotValue };

/** Lookups by code for every entity in a snapshot (ADMIN-BACKEND §6 `index`). */
export type CatalogIndex = {
  catalog: CatalogSnapshot;
  products: Map<string, SnapshotProduct>;
  components: Map<string, SnapshotComponent>;
  groups: Map<string, IndexedGroup>;
  attributes: Map<string, IndexedAttribute>;
  /** Keyed by `valueKey(attributeCode, valueCode)`. */
  values: Map<string, IndexedValue>;
  materials: Map<string, SnapshotMaterial>;
  rules: Map<string, SnapshotRule>;
  templates: Map<string, SnapshotTemplate>;
  lookups: Map<string, Map<string, SnapshotLookupValue>>;
  media: Map<string, SnapshotMedia>;
};

// The customer runtime (structure, garment, pricing, binding and outline) reads
// only fields that the public projection keeps, so the same pure code runs on
// the server over a snapshot and in the browser over /api/catalog/v/{version}.
// A CatalogSnapshot and a CustomerCatalog both satisfy RuntimeCatalog, and a
// CatalogIndex is assignable to a RuntimeIndex.
export type RuntimeComponent = CustomerCatalog['components'][number];
export type RuntimeGroup = RuntimeComponent['groups'][number];
export type RuntimeAttribute = RuntimeGroup['attributes'][number];
export type RuntimeValue = RuntimeAttribute['values'][number];
export type RuntimeProduct = CustomerCatalog['products'][number];
export type RuntimeProductComponent = RuntimeProduct['components'][number];
export type RuntimeMaterial = Omit<CustomerCatalog['materials'][number], 'supplier'>;
export type RuntimeRule = CustomerCatalog['rules'][number];
export type RuntimeTemplate = CustomerCatalog['templates'][number];
export type RuntimeMedia = CustomerCatalog['media'][string];
export type RuntimeCatalog = Omit<CustomerCatalog, 'materials'> & { materials: RuntimeMaterial[] };
export type RuntimeIndex = {
  catalog: RuntimeCatalog;
  products: Map<string, RuntimeProduct>;
  components: Map<string, RuntimeComponent>;
  groups: Map<string, { group: RuntimeGroup; component: RuntimeComponent }>;
  attributes: Map<
    string,
    { group: RuntimeGroup; component: RuntimeComponent; attribute: RuntimeAttribute }
  >;
  /** Keyed by `valueKey(attributeCode, valueCode)`. */
  values: Map<
    string,
    {
      group: RuntimeGroup;
      component: RuntimeComponent;
      attribute: RuntimeAttribute;
      value: RuntimeValue;
    }
  >;
  materials: Map<string, RuntimeMaterial>;
  rules: Map<string, RuntimeRule>;
  templates: Map<string, RuntimeTemplate>;
  lookups: Map<string, Map<string, SnapshotLookupValue>>;
  media: Map<string, RuntimeMedia>;
};

/** Index a customer catalog (or a snapshot) for the runtime. */
export function indexCatalog(catalog: RuntimeCatalog): RuntimeIndex {
  return buildIndex(catalog);
}

export function indexSnapshot(snapshot: CatalogSnapshot): CatalogIndex {
  // The same objects, typed with the snapshot's full entity types.
  return buildIndex(snapshot) as unknown as CatalogIndex;
}

function buildIndex(snapshot: RuntimeCatalog): RuntimeIndex {
  const index: RuntimeIndex = {
    catalog: snapshot,
    products: new Map(snapshot.products.map((item) => [item.code, item])),
    components: new Map(snapshot.components.map((item) => [item.code, item])),
    groups: new Map(),
    attributes: new Map(),
    values: new Map(),
    materials: new Map(snapshot.materials.map((item) => [item.code, item])),
    rules: new Map(snapshot.rules.map((item) => [item.code, item])),
    templates: new Map(snapshot.templates.map((item) => [item.code, item])),
    lookups: new Map(
      Object.entries(snapshot.lookups).map(([type, values]) => [
        type,
        new Map(values.map((value) => [value.code, value])),
      ]),
    ),
    media: new Map(Object.entries(snapshot.media)),
  };
  for (const component of snapshot.components)
    for (const group of component.groups) {
      index.groups.set(group.code, { group, component });
      for (const attribute of group.attributes) {
        index.attributes.set(attribute.code, { group, component, attribute });
        for (const value of attribute.values)
          index.values.set(valueKey(attribute.code, value.code), {
            group,
            component,
            attribute,
            value,
          });
      }
    }
  return index;
}
