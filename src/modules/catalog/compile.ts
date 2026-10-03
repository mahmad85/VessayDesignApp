import type { Condition } from './conditions';
import { newGarment } from './garment';
import { quoteGarment } from '../pricing/quote';
import { defaultsFor } from './structure';
import {
  normalizeSnapshot,
  indexSnapshot,
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
  type TextRules,
} from './snapshot';

// Working tables → CatalogSnapshot (CATALOG-ADMIN.md §7.1, ADMIN-BACKEND.md §5).
// Pure: the rows come from db/catalog-admin-repository.ts#loadWorkingRows.
// Only `active` rows are compiled; `draft` and `archived` rows are ignored.
// The compiler never throws on incomplete admin data: invalid conditions, a
// missing default material or focus region and similar gaps are carried into
// the snapshot so validateRelease() can report them against the right entity.

type Status = 'draft' | 'active' | 'archived';
type Json = Record<string, string | number | boolean>;
export type WorkingRows = {
  commerce: {
    currency: string;
    shipping_flat_minor: number;
    ship_countries: string[];
    quote_ttl_minutes: number;
    order_number_prefix: string;
  };
  lookupTypes: { code: string }[];
  lookupValues: {
    type_code: string;
    code: string;
    label: string;
    description: string;
    sort: number;
    active: boolean;
    metadata: Record<string, unknown>;
  }[];
  priceBands: { code: string; name: string; sort: number; uplift_minor: number }[];
  media: {
    id: string;
    storage_driver: string;
    storage_key: string;
    content_type: SnapshotMedia['contentType'];
    width: number | null;
    height: number | null;
    alt_text: string;
    rights_status: SnapshotMedia['rightsStatus'];
  }[];
  suppliers: { id: string; name: string }[];
  components: {
    id: string;
    code: string;
    name: string;
    description: string;
    visual_part: SnapshotComponent['visualPart'];
    sort: number;
    status: Status;
    reference_only: boolean;
  }[];
  groups: {
    id: string;
    code: string;
    component_id: string;
    name: string;
    short_name: string;
    description: string;
    kind: SnapshotGroup['kind'];
    line_kind: SnapshotGroup['lineKind'];
    icon_media_id: string | null;
    focus_region: string | null;
    surcharge_minor: number;
    visible_when: unknown;
    metadata: Json;
    sort: number;
    status: Status;
    reference_only: boolean;
  }[];
  attributes: {
    id: string;
    code: string;
    group_id: string;
    name: string;
    help_text: string;
    input_type: SnapshotAttribute['inputType'];
    required: boolean;
    text_rules: unknown;
    visual_slot: string | null;
    metadata_fields: unknown;
    surcharge_minor: number;
    visible_when: unknown;
    legacy_key: string | null;
    sort: number;
    status: Status;
    reference_only: boolean;
  }[];
  values: {
    id: string;
    attribute_id: string;
    code: string;
    label: string;
    description: string;
    image_media_id: string | null;
    is_default: boolean;
    is_off: boolean;
    surcharge_minor: number;
    supplier_code: string | null;
    visual_token: string | null;
    metadata: Json;
    sort: number;
    status: Status;
    reference_only: boolean;
  }[];
  products: {
    id: string;
    code: string;
    name: string;
    short_label: string;
    description: string;
    measurement_set: SnapshotProduct['measurementSet'];
    visual_model: SnapshotProduct['visualModel'];
    default_material_id: string | null;
    hero_media_id: string | null;
    base_price_minor: number | null;
    sort: number;
    status: Status;
    reference_only: boolean;
  }[];
  productComponents: {
    product_id: string;
    component_id: string;
    required: boolean;
    default_included: boolean;
    surcharge_minor: number;
    include_label: string | null;
    sort: number;
    metadata: Json;
  }[];
  bandPrices: { product_id: string; band_code: string; price_minor: number }[];
  settings: {
    product_id: string;
    scope: 'group' | 'attribute' | 'value';
    group_id: string | null;
    attribute_id: string | null;
    value_id: string | null;
    available: boolean;
    default_value_id: string | null;
    surcharge_override_minor: number | null;
  }[];
  materials: {
    id: string;
    code: string;
    name: string;
    status: Status;
    supplier_id: string | null;
    supplier_article_code: string | null;
    mill_name: string | null;
    display_mill_name: boolean;
    collection_name: string | null;
    season_code: string | null;
    colour_name: string | null;
    colour_family_code: string | null;
    primary_hex: string | null;
    secondary_hex: string | null;
    pattern_code: string | null;
    weave_code: string | null;
    texture_code: string | null;
    sheen_code: string | null;
    finish_codes: string[];
    composition: { fibre: string; percent: number }[];
    weight_gsm: number | null;
    super_number: number | null;
    yarn_count: string | null;
    width_cm: number | null;
    stretch_code: string | null;
    season_codes: string[];
    climate_codes: string[];
    occasion_codes: string[];
    formality: number | null;
    wrinkle_resistance: SnapshotMaterial['wrinkleResistance'];
    breathability: SnapshotMaterial['breathability'];
    opacity: SnapshotMaterial['opacity'];
    drape: SnapshotMaterial['drape'];
    care_codes: string[];
    description_short: string;
    story: string;
    tag_codes: string[];
    usages: SnapshotMaterial['usages'];
    price_band_code: string | null;
    texture_scale_cm: string | number | null;
    metadata: Json;
    reference_only: boolean;
  }[];
  materialProducts: { material_id: string; product_id: string }[];
  materialMedia: {
    material_id: string;
    media_id: string;
    role: SnapshotMaterial['media'][number]['role'];
    sort: number;
  }[];
  materialOverrides: { material_id: string; product_id: string; price_minor: number }[];
  rules: {
    id: string;
    code: string;
    name: string;
    product_ids: string[];
    when_condition: unknown;
    effect: 'forbid' | 'require';
    attribute_id: string;
    value_ids: string[];
    customer_message: string;
    sort: number;
    status: Status;
  }[];
  templates: {
    id: string;
    code: string;
    product_id: string;
    material_id: string;
    name: string;
    subtitle: string;
    description: string;
    story: string;
    included_components: string[];
    selections: Record<string, string>;
    occasion_codes: string[];
    climate_codes: string[];
    featured: boolean;
    sort: number;
    status: Status;
    reference_only: boolean;
  }[];
  templateMedia: {
    template_id: string;
    media_id: string;
    role: 'hero' | 'gallery';
    sort: number;
  }[];
};

const active = <T extends { status: Status }>(rows: T[]) =>
  rows.filter((row) => row.status === 'active');
const groupBy = <T, K>(rows: T[], key: (row: T) => K) => {
  const map = new Map<K, T[]>();
  for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
  return map;
};
const bySort = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort;
const numberOrNull = (value: string | number | null) => (value === null ? null : Number(value));

/** Media URL: static media are served from /public; stored media through /api/media. */
export function mediaUrl(row: { id: string; storage_driver: string; storage_key: string }) {
  return row.storage_driver === 'static' ? row.storage_key : `/api/media/${row.id}`;
}

export function compileWorkingCopy(rows: WorkingRows): CatalogSnapshot {
  const usedMedia = new Set<string>();
  const use = (id: string | null) => {
    if (id) usedMedia.add(id);
    return id;
  };

  const componentRows = active(rows.components);
  const groupsByComponent = groupBy(active(rows.groups), (row) => row.component_id);
  const attributesByGroup = groupBy(active(rows.attributes), (row) => row.group_id);
  const liveValues = rows.values.filter((row) => row.status !== 'archived');
  const valuesByAttribute = groupBy(active(rows.values), (row) => row.attribute_id);
  const defaultCode = new Map(
    liveValues.filter((row) => row.is_default).map((row) => [row.attribute_id, row.code]),
  );

  const componentCodeById = new Map(rows.components.map((row) => [row.id, row.code]));
  const groupCodeById = new Map(rows.groups.map((row) => [row.id, row.code]));
  const attributeById = new Map(rows.attributes.map((row) => [row.id, row]));
  const valueById = new Map(rows.values.map((row) => [row.id, row]));
  const productCodeById = new Map(rows.products.map((row) => [row.id, row.code]));
  const materialCodeById = new Map(rows.materials.map((row) => [row.id, row.code]));

  const compiledIds = {
    components: new Set(componentRows.map((row) => row.id)),
    groups: new Set<string>(),
    attributes: new Set<string>(),
    values: new Set<string>(),
  };

  const components: SnapshotComponent[] = componentRows.map((component) => ({
    code: component.code,
    name: component.name,
    description: component.description,
    visualPart: component.visual_part,
    sort: component.sort,
    referenceOnly: component.reference_only,
    groups: (groupsByComponent.get(component.id) ?? []).map((group): SnapshotGroup => {
      compiledIds.groups.add(group.id);
      return {
        code: group.code,
        name: group.name,
        shortName: group.short_name,
        description: group.description,
        kind: group.kind,
        lineKind: group.line_kind,
        iconMediaId: use(group.icon_media_id),
        focusRegion: group.focus_region ?? '',
        surchargeMinor: group.surcharge_minor,
        visibleWhen: (group.visible_when ?? null) as Condition | null,
        sort: group.sort,
        referenceOnly: group.reference_only,
        metadata: group.metadata,
        attributes: (attributesByGroup.get(group.id) ?? []).map((attribute): SnapshotAttribute => {
          compiledIds.attributes.add(attribute.id);
          return {
            code: attribute.code,
            name: attribute.name,
            helpText: attribute.help_text,
            inputType: attribute.input_type,
            required: attribute.required,
            textRules: (attribute.text_rules ?? null) as TextRules | null,
            visualSlot: attribute.visual_slot,
            surchargeMinor: attribute.surcharge_minor,
            visibleWhen: (attribute.visible_when ?? null) as Condition | null,
            sort: attribute.sort,
            metadataFields: (attribute.metadata_fields ?? []) as MetadataField[],
            defaultValueCode: defaultCode.get(attribute.id) ?? null,
            referenceOnly: attribute.reference_only,
            legacyKey: attribute.legacy_key,
            values: (valuesByAttribute.get(attribute.id) ?? []).map((value): SnapshotValue => {
              compiledIds.values.add(value.id);
              return {
                code: value.code,
                label: value.label,
                description: value.description,
                imageMediaId: use(value.image_media_id),
                surchargeMinor: value.surcharge_minor,
                supplierCode: value.supplier_code,
                visualToken: value.visual_token,
                isOff: value.is_off,
                sort: value.sort,
                metadata: value.metadata,
                referenceOnly: value.reference_only,
              };
            }),
          };
        }),
      };
    }),
  }));

  const productRows = active(rows.products);
  const activeProductIds = new Set(productRows.map((row) => row.id));
  const linksByProduct = groupBy(rows.productComponents, (row) => row.product_id);
  const pricesByProduct = groupBy(rows.bandPrices, (row) => row.product_id);
  const settingsByProduct = groupBy(rows.settings, (row) => row.product_id);
  const products: SnapshotProduct[] = productRows.map((product) => {
    const settings: SnapshotProduct['settings'] = { groups: {}, attributes: {}, values: {} };
    for (const setting of settingsByProduct.get(product.id) ?? []) {
      const override = setting.surcharge_override_minor;
      if (setting.scope === 'group' && setting.group_id && compiledIds.groups.has(setting.group_id))
        settings.groups[groupCodeById.get(setting.group_id)!] = {
          available: setting.available,
          surchargeOverrideMinor: override,
        };
      if (
        setting.scope === 'attribute' &&
        setting.attribute_id &&
        compiledIds.attributes.has(setting.attribute_id)
      )
        settings.attributes[attributeById.get(setting.attribute_id)!.code] = {
          available: setting.available,
          defaultValueCode: setting.default_value_id
            ? (valueById.get(setting.default_value_id)?.code ?? null)
            : null,
          surchargeOverrideMinor: override,
        };
      if (
        setting.scope === 'value' &&
        setting.value_id &&
        compiledIds.values.has(setting.value_id)
      ) {
        const value = valueById.get(setting.value_id)!;
        settings.values[valueKey(attributeById.get(value.attribute_id)!.code, value.code)] = {
          available: setting.available,
          surchargeOverrideMinor: override,
        };
      }
    }
    return {
      code: product.code,
      name: product.name,
      shortLabel: product.short_label,
      description: product.description,
      sort: product.sort,
      heroMediaId: use(product.hero_media_id),
      measurementSet: product.measurement_set,
      visualModel: product.visual_model,
      defaultMaterialCode: product.default_material_id
        ? (materialCodeById.get(product.default_material_id) ?? '')
        : '',
      referenceOnly: product.reference_only,
      components: (linksByProduct.get(product.id) ?? [])
        .filter((link) => compiledIds.components.has(link.component_id))
        .map((link) => ({
          componentCode: componentCodeById.get(link.component_id)!,
          required: link.required,
          defaultIncluded: link.default_included,
          surchargeMinor: link.surcharge_minor,
          includeLabel: link.include_label,
          sort: link.sort,
          metadata: link.metadata,
        })),
      // Written only when set, so a catalog priced before D-022 keeps its checksum.
      ...(product.base_price_minor !== null && { basePriceMinor: product.base_price_minor }),
      // PRC-002 (D-022): base price plus each tier's uplift; stored band prices
      // remain for a product priced before D-022.
      bandPrices: Object.fromEntries(
        product.base_price_minor !== null
          ? rows.priceBands.map((band) => [
              band.code,
              product.base_price_minor! + band.uplift_minor,
            ])
          : (pricesByProduct.get(product.id) ?? []).map((row) => [row.band_code, row.price_minor]),
      ),
      settings,
    };
  });

  const renderPattern = new Map(
    rows.lookupValues
      .filter((row) => row.type_code === 'pattern')
      .map((row) => [row.code, row.metadata.renderPattern]),
  );
  const supplierById = new Map(rows.suppliers.map((row) => [row.id, row]));
  const productsByMaterial = groupBy(rows.materialProducts, (row) => row.material_id);
  const mediaByMaterial = groupBy(rows.materialMedia, (row) => row.material_id);
  const overridesByMaterial = groupBy(rows.materialOverrides, (row) => row.material_id);
  const materials: SnapshotMaterial[] = active(rows.materials).map((material) => {
    const render = renderPattern.get(material.pattern_code ?? '');
    const supplier = material.supplier_id ? supplierById.get(material.supplier_id) : undefined;
    return {
      code: material.code,
      name: material.name,
      colourName: material.colour_name,
      colourFamily: material.colour_family_code,
      primaryHex: material.primary_hex ?? '',
      secondaryHex: material.secondary_hex,
      pattern: material.pattern_code ?? '',
      renderPattern: (['plain', 'twill', 'check', 'stripe'].includes(render as string)
        ? render
        : 'plain') as SnapshotMaterial['renderPattern'],
      weave: material.weave_code,
      texture: material.texture_code,
      sheen: material.sheen_code,
      finishes: material.finish_codes,
      composition: material.composition,
      weightGsm: material.weight_gsm,
      superNumber: material.super_number,
      yarnCount: material.yarn_count,
      widthCm: material.width_cm,
      stretch: material.stretch_code,
      seasons: material.season_codes,
      climates: material.climate_codes,
      occasions: material.occasion_codes,
      formality: material.formality,
      wrinkleResistance: material.wrinkle_resistance,
      breathability: material.breathability,
      opacity: material.opacity,
      drape: material.drape,
      care: material.care_codes,
      descriptionShort: material.description_short,
      story: material.story,
      tags: material.tag_codes,
      usages: material.usages,
      productCodes: (productsByMaterial.get(material.id) ?? [])
        .filter((row) => activeProductIds.has(row.product_id))
        .map((row) => productCodeById.get(row.product_id)!),
      priceBand: material.price_band_code,
      priceOverrides: Object.fromEntries(
        (overridesByMaterial.get(material.id) ?? [])
          .filter((row) => activeProductIds.has(row.product_id))
          .map((row) => [productCodeById.get(row.product_id)!, row.price_minor]),
      ),
      media: (mediaByMaterial.get(material.id) ?? []).map((row) => ({
        mediaId: use(row.media_id)!,
        role: row.role,
        sort: row.sort,
      })),
      textureScaleCm: numberOrNull(material.texture_scale_cm),
      metadata: material.metadata,
      referenceOnly: material.reference_only,
      supplier: supplier
        ? { id: supplier.id, name: supplier.name, articleCode: material.supplier_article_code }
        : null,
      millName: material.mill_name,
      displayMillName: material.display_mill_name,
      collection: material.collection_name,
      seasonCode: material.season_code,
    };
  });

  const rules = active(rows.rules)
    .sort((a, b) => a.sort - b.sort || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
    .map((rule) => ({
      code: rule.code,
      name: rule.name,
      productCodes: rule.product_ids.map((id) => productCodeById.get(id) ?? id),
      when: rule.when_condition as Condition,
      effect: rule.effect,
      attributeCode: attributeById.get(rule.attribute_id)?.code ?? rule.attribute_id,
      valueCodes: rule.value_ids.map((id) => valueById.get(id)?.code ?? id),
      message: rule.customer_message,
    }));

  const mediaByTemplate = groupBy(rows.templateMedia, (row) => row.template_id);
  const templates = active(rows.templates).map((template) => {
    const media = [...(mediaByTemplate.get(template.id) ?? [])].sort(bySort);
    return {
      code: template.code,
      productCode: productCodeById.get(template.product_id) ?? '',
      name: template.name,
      subtitle: template.subtitle,
      description: template.description,
      story: template.story,
      materialCode: materialCodeById.get(template.material_id) ?? '',
      includedComponents: template.included_components,
      selections: template.selections,
      occasions: template.occasion_codes,
      climates: template.climate_codes,
      featured: template.featured,
      sort: template.sort,
      heroMediaId: use(media.find((row) => row.role === 'hero')?.media_id ?? null),
      galleryMediaIds: media
        .filter((row) => row.role === 'gallery')
        .map((row) => use(row.media_id)!),
      // Priced at publish from the same release (TPL-004, WP-34).
      asShownPriceMinor: null,
      referenceOnly: template.reference_only,
    };
  });

  // Only types with active values appear in a release.
  const lookups = Object.fromEntries(
    rows.lookupTypes
      .map((type) => [
        type.code,
        rows.lookupValues
          .filter((row) => row.type_code === type.code && row.active)
          .map((row) => ({
            code: row.code,
            label: row.label,
            description: row.description,
            sort: row.sort,
            metadata: row.metadata,
          })),
      ])
      .filter(([, values]) => values.length),
  );

  const media: Record<string, SnapshotMedia> = {};
  for (const row of rows.media)
    if (usedMedia.has(row.id))
      media[row.id] = {
        id: row.id,
        url: mediaUrl(row),
        contentType: row.content_type,
        width: row.width,
        height: row.height,
        alt: row.alt_text,
        rightsStatus: row.rights_status,
      };

  const referenceOnly = [
    ...components,
    ...components.flatMap((component) => component.groups),
    ...components.flatMap((component) =>
      component.groups.flatMap((group) => [
        ...group.attributes,
        ...group.attributes.flatMap((attribute) => attribute.values),
      ]),
    ),
    ...products,
    ...materials,
    ...templates,
  ].some((entity) => entity.referenceOnly);

  // A release carries the price bands it uses: bands have no status, so an
  // unused band (a new one, or one left after a restore) stays out.
  const usedBands = new Set([
    ...products.flatMap((product) => Object.keys(product.bandPrices)),
    ...materials.flatMap((material) => (material.priceBand ? [material.priceBand] : [])),
  ]);

  const snapshot = normalizeSnapshot({
    schemaVersion: 1,
    version: 0,
    publishedAt: '',
    referenceOnly,
    currency: rows.commerce.currency,
    settings: {
      shippingFlatMinor: rows.commerce.shipping_flat_minor,
      quoteTtlMinutes: rows.commerce.quote_ttl_minutes,
      orderNumberPrefix: rows.commerce.order_number_prefix,
      shipCountries: rows.commerce.ship_countries,
    },
    lookups,
    priceBands: rows.priceBands
      .filter((row) => usedBands.has(row.code))
      .map((row) => ({
        code: row.code,
        name: row.name,
        sort: row.sort,
        ...(row.uplift_minor > 0 && { upliftMinor: row.uplift_minor }),
      })),
    media,
    components,
    products,
    materials,
    rules,
    templates,
  });
  const index = indexSnapshot(snapshot);
  for (const template of snapshot.templates) {
    const product = index.products.get(template.productCode);
    if (!product) continue;
    template.selections = { ...defaultsFor(index, product), ...template.selections };
    template.includedComponents = [
      ...new Set([
        ...product.components.filter((c) => c.required).map((c) => c.componentCode),
        ...template.includedComponents,
      ]),
    ];
    const quote = quoteGarment(
      index,
      newGarment(index, product.code, 'template-price', template.code),
    );
    template.asShownPriceMinor = quote.status === 'priced' ? quote.unitMinor : null;
  }
  return normalizeSnapshot(snapshot);
}

/** Inactive lookup values, which validateRelease() reports as `lookup_inactive_in_use` when used. */
export function inactiveLookups(rows: WorkingRows): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const row of rows.lookupValues)
    if (!row.active) (result[row.type_code] ??= []).push(row.code);
  return result;
}
