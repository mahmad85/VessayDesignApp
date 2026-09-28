import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson } from '@/lib/canonical-json';
import type { WorkingRows } from '@/modules/catalog/compile';
import { valueKey, type CatalogSnapshot } from '@/modules/catalog/snapshot';
import type { LookupTypeSeed } from '@/modules/catalog/lookup-seeds';
import { writeAudit } from './audit';
import type { Query } from './client';

// Working-copy access for the catalog (CATALOG-ADMIN.md §7.1–7.2, §7.5).
// This package provides the reads the compiler needs and the loader used by
// bootstrap and restore. Admin CRUD arrives with TASK-019.

type Row = Record<string, unknown>;

export async function loadWorkingRows(query: Query): Promise<WorkingRows> {
  const all = (table: string) => query(`SELECT * FROM ${table}`) as Promise<never>;
  const [commerce] = await query(
    "SELECT currency,shipping_flat_minor,ship_countries,quote_ttl_minutes,order_number_prefix FROM commerce_settings WHERE id='default'",
  );
  return {
    commerce: commerce as WorkingRows['commerce'],
    lookupTypes: await all('lookup_types'),
    lookupValues: await all('lookup_values'),
    priceBands: await all('price_bands'),
    media: await all('media_assets'),
    suppliers: (await query('SELECT id,name FROM suppliers')) as never,
    components: await all('components'),
    groups: await all('option_groups'),
    attributes: await all('attributes'),
    values: await all('option_values'),
    products: await all('products'),
    productComponents: await all('product_components'),
    bandPrices: await all('product_band_prices'),
    settings: await all('product_option_settings'),
    materials: await all('materials'),
    materialProducts: await all('material_products'),
    materialMedia: await all('material_media'),
    materialOverrides: await all('material_price_overrides'),
    rules: await all('compatibility_rules'),
    templates: await all('templates'),
    templateMedia: await all('template_media'),
  };
}

/** Seeds the system lookup types; never overwrites an admin's edits. */
export async function seedLookupTypes(query: Query, types: LookupTypeSeed[]) {
  for (const type of types)
    await query(
      'INSERT INTO lookup_types(code,label,description,system,value_metadata_schema) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT (code) DO NOTHING',
      [
        type.code,
        type.label,
        type.description,
        type.system,
        JSON.stringify(type.valueMetadataSchema),
      ],
    );
}

const JSON_COLUMNS = new Set([
  'metadata',
  'visible_when',
  'text_rules',
  'metadata_fields',
  'composition',
  'when_condition',
  'selections',
]);
const ARRAY_COLUMNS = new Set([
  'finish_codes',
  'season_codes',
  'climate_codes',
  'occasion_codes',
  'care_codes',
  'tag_codes',
  'usages',
  'product_ids',
  'value_ids',
  'included_components',
]);
const VERSIONED = new Set([
  'lookup_values',
  'price_bands',
  'media_assets',
  'components',
  'option_groups',
  'attributes',
  'option_values',
  'products',
  'product_components',
  'product_band_prices',
  'product_option_settings',
  'materials',
  'material_price_overrides',
  'compatibility_rules',
  'templates',
]);
const cast = (column: string) =>
  JSON_COLUMNS.has(column) ? '::jsonb' : ARRAY_COLUMNS.has(column) ? '::text[]' : '';
const param = (column: string, value: unknown) =>
  JSON_COLUMNS.has(column) && value !== null && value !== undefined
    ? JSON.stringify(value)
    : (value ?? null);

function same(a: unknown, b: unknown) {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  if (typeof a === 'object' || typeof b === 'object') return canonicalJson(a) === canonicalJson(b);
  return a === b;
}

export type LoadCounts = { created: number; updated: number; archived: number; deleted: number };
export type LoadSummary = LoadCounts & { byTable: Record<string, LoadCounts>; changed: boolean };

type Options = {
  /** Reads a static media file (default: `public/` of the working directory). */
  readStatic?: (url: string) => Promise<Uint8Array>;
};
const defaultReadStatic = (url: string) =>
  readFile(path.join(process.cwd(), 'public', ...url.split('/').filter(Boolean)));

/**
 * Loads a snapshot into the working tables (bootstrap and restore, CATALOG-ADMIN
 * §7.5): upsert by code keeping existing ids, archive catalog rows missing from
 * the snapshot, and replace the snapshot products' and materials' links. Live
 * material availability and commerce settings are never written. Loading the
 * same snapshot twice changes nothing and writes no audit event.
 */
export async function loadSnapshotIntoWorkingCopy(
  query: Query,
  snapshot: CatalogSnapshot,
  actor: string,
  options: Options = {},
): Promise<LoadSummary> {
  const readStatic = options.readStatic ?? defaultReadStatic;
  const byTable: Record<string, LoadCounts> = {};
  const count = (table: string, kind: keyof LoadCounts, n = 1) => {
    byTable[table] ??= { created: 0, updated: 0, archived: 0, deleted: 0 };
    byTable[table][kind] += n;
  };
  const existing = async (table: string) => (await query(`SELECT * FROM ${table}`)) as Row[];

  /** Inserts or updates one row, comparing only the columns given. */
  async function put(table: string, key: Row, values: Row, current: Row | undefined) {
    if (current) {
      const changed = Object.keys(values).filter(
        (column) => !same(current[column], values[column]),
      );
      if (!changed.length) return current;
      const sets = changed.map((column, i) => `${column}=$${i + 1}${cast(column)}`);
      if (VERSIONED.has(table)) sets.push('row_version=row_version+1', 'updated_at=now()');
      const keys = Object.keys(key);
      await query(
        `UPDATE ${table} SET ${sets.join(',')} WHERE ${keys.map((column, i) => `${column}=$${changed.length + i + 1}`).join(' AND ')}`,
        [
          ...changed.map((column) => param(column, values[column])),
          ...keys.map((column) => key[column]),
        ],
      );
      count(table, 'updated');
      return { ...current, ...values };
    }
    const row = { ...key, ...values };
    const columns = Object.keys(row);
    await query(
      `INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map((column, i) => `$${i + 1}${cast(column)}`).join(',')})`,
      columns.map((column) => param(column, row[column])),
    );
    count(table, 'created');
    return row;
  }
  async function archive(table: string, rows: Row[], keep: Set<string>, extra = '') {
    const ids = rows
      .filter((row) => row.status !== 'archived' && !keep.has(row.id as string))
      .map((row) => row.id as string);
    if (!ids.length) return;
    await query(
      `UPDATE ${table} SET status='archived'${extra},row_version=row_version+1,updated_at=now() WHERE id = ANY($1::text[])`,
      [ids],
    );
    count(table, 'archived', ids.length);
  }
  /** Replaces link rows of the given owners with the desired set. */
  async function syncLinks(
    table: string,
    ownerColumn: string,
    owners: Set<string>,
    keyColumns: string[],
    desired: { key: Row; values: Row }[],
  ) {
    const current = (await existing(table)).filter((row) => owners.has(row[ownerColumn] as string));
    const id = (row: Row) => keyColumns.map((column) => row[column]).join('\u0000');
    const byKey = new Map(current.map((row) => [id(row), row]));
    const wanted = new Set<string>();
    for (const item of desired) {
      wanted.add(id(item.key));
      await put(table, item.key, item.values, byKey.get(id(item.key)));
    }
    for (const row of current)
      if (!wanted.has(id(row))) {
        await query(
          `DELETE FROM ${table} WHERE ${keyColumns.map((column, i) => `${column}=$${i + 1}`).join(' AND ')}`,
          keyColumns.map((column) => row[column]),
        );
        count(table, 'deleted');
      }
  }
  const byCode = (rows: Row[]) => new Map(rows.map((row) => [row.code as string, row]));

  // Lookups: types first (bootstrap seeds real labels beforehand), then values.
  const types = new Set((await existing('lookup_types')).map((row) => row.code as string));
  for (const code of Object.keys(snapshot.lookups))
    if (!types.has(code)) {
      await query('INSERT INTO lookup_types(code,label) VALUES($1,$2)', [code, code]);
      count('lookup_types', 'created');
    }
  const lookupRows = await existing('lookup_values');
  const lookupByKey = new Map(lookupRows.map((row) => [`${row.type_code}::${row.code}`, row]));
  const keptLookups = new Set<string>();
  for (const [type, values] of Object.entries(snapshot.lookups))
    for (const value of values) {
      const current = lookupByKey.get(`${type}::${value.code}`);
      const row = await put(
        'lookup_values',
        { id: current?.id ?? crypto.randomUUID() },
        {
          type_code: type,
          code: value.code,
          label: value.label,
          description: value.description,
          sort: value.sort,
          active: true,
          metadata: value.metadata,
        },
        current,
      );
      keptLookups.add(row.id as string);
    }
  const staleLookups = lookupRows.filter((row) => row.active && !keptLookups.has(row.id as string));
  if (staleLookups.length) {
    await query(
      'UPDATE lookup_values SET active=false,row_version=row_version+1,updated_at=now() WHERE id = ANY($1::text[])',
      [staleLookups.map((row) => row.id)],
    );
    count('lookup_values', 'archived', staleLookups.length);
  }

  // Price bands have no status; bands missing from the snapshot are kept.
  const bands = byCode(await existing('price_bands'));
  for (const band of snapshot.priceBands)
    await put(
      'price_bands',
      { code: band.code },
      { name: band.name, sort: band.sort },
      bands.get(band.code),
    );

  // Media: matched by id, then by static path; stored media must already exist.
  const mediaRows = await existing('media_assets');
  const mediaById = new Map(mediaRows.map((row) => [row.id as string, row]));
  const staticMedia = new Map(
    mediaRows
      .filter((row) => row.storage_driver === 'static')
      .map((row) => [row.storage_key as string, row]),
  );
  const mediaId = new Map<string, string>();
  for (const media of Object.values(snapshot.media)) {
    const isStatic = !media.url.startsWith('/api/media/');
    const current = mediaById.get(media.id) ?? (isStatic ? staticMedia.get(media.url) : undefined);
    if (current) {
      await put(
        'media_assets',
        { id: current.id },
        { alt_text: media.alt, rights_status: media.rightsStatus },
        current,
      );
      mediaId.set(media.id, current.id as string);
      continue;
    }
    if (!isStatic) throw new Error(`Media ${media.id} is not in the media library.`);
    const bytes = await readStatic(media.url);
    await put(
      'media_assets',
      { id: media.id },
      {
        storage_driver: 'static',
        storage_key: media.url,
        content_type: media.contentType,
        bytes: bytes.byteLength,
        width: media.width,
        height: media.height,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        alt_text: media.alt,
        rights_status: media.rightsStatus,
        created_by: actor,
      },
      undefined,
    );
    mediaId.set(media.id, media.id);
  }
  const media = (id: string | null) => (id ? (mediaId.get(id) ?? id) : null);

  // Components → groups → attributes → values.
  const componentRows = await existing('components');
  const components = byCode(componentRows);
  const componentIds = new Map<string, string>();
  for (const component of snapshot.components) {
    const current = components.get(component.code);
    const row = await put(
      'components',
      { id: current?.id ?? crypto.randomUUID() },
      {
        code: component.code,
        name: component.name,
        description: component.description,
        visual_part: component.visualPart,
        sort: component.sort,
        status: 'active',
        reference_only: component.referenceOnly,
      },
      current,
    );
    componentIds.set(component.code, row.id as string);
  }
  await archive('components', componentRows, new Set(componentIds.values()));

  const groupRows = await existing('option_groups');
  const groups = byCode(groupRows);
  const groupIds = new Map<string, string>();
  const attributeRows = await existing('attributes');
  const attributes = byCode(attributeRows);
  const attributeIds = new Map<string, string>();
  for (const component of snapshot.components)
    for (const group of component.groups) {
      const current = groups.get(group.code);
      const row = await put(
        'option_groups',
        { id: current?.id ?? crypto.randomUUID() },
        {
          code: group.code,
          component_id: componentIds.get(component.code),
          name: group.name,
          short_name: group.shortName,
          description: group.description,
          kind: group.kind,
          line_kind: group.lineKind,
          icon_media_id: media(group.iconMediaId),
          focus_region: group.focusRegion || null,
          surcharge_minor: group.surchargeMinor,
          visible_when: group.visibleWhen,
          metadata: group.metadata,
          sort: group.sort,
          status: 'active',
          reference_only: group.referenceOnly,
        },
        current,
      );
      groupIds.set(group.code, row.id as string);
      for (const attribute of group.attributes) {
        const currentAttribute = attributes.get(attribute.code);
        const saved = await put(
          'attributes',
          { id: currentAttribute?.id ?? crypto.randomUUID() },
          {
            code: attribute.code,
            group_id: row.id,
            name: attribute.name,
            help_text: attribute.helpText,
            input_type: attribute.inputType,
            required: attribute.required,
            text_rules: attribute.textRules,
            visual_slot: attribute.visualSlot,
            metadata_fields: attribute.metadataFields,
            surcharge_minor: attribute.surchargeMinor,
            visible_when: attribute.visibleWhen,
            legacy_key: attribute.legacyKey,
            sort: attribute.sort,
            status: 'active',
            reference_only: attribute.referenceOnly,
          },
          currentAttribute,
        );
        attributeIds.set(attribute.code, saved.id as string);
      }
    }
  await archive('option_groups', groupRows, new Set(groupIds.values()));
  await archive('attributes', attributeRows, new Set(attributeIds.values()));

  // Values: archive first and clear old defaults before setting new ones, so
  // the one-default-per-option index is never violated mid-load.
  const valueRows = await existing('option_values');
  const valueByKey = new Map(valueRows.map((row) => [`${row.attribute_id}::${row.code}`, row]));
  const desiredValues = snapshot.components.flatMap((component) =>
    component.groups.flatMap((group) =>
      group.attributes.flatMap((attribute) =>
        attribute.values.map((value) => ({ attribute, value })),
      ),
    ),
  );
  const valueIds = new Map<string, string>();
  const keptValues = new Set(
    desiredValues
      .map(
        ({ attribute, value }) =>
          valueByKey.get(`${attributeIds.get(attribute.code)}::${value.code}`)?.id,
      )
      .filter(Boolean) as string[],
  );
  await archive('option_values', valueRows, keptValues, ',is_default=false');
  const ordered = [
    ...desiredValues.filter(({ attribute, value }) => attribute.defaultValueCode !== value.code),
    ...desiredValues.filter(({ attribute, value }) => attribute.defaultValueCode === value.code),
  ];
  for (const { attribute, value } of ordered) {
    const attributeId = attributeIds.get(attribute.code)!;
    const current = valueByKey.get(`${attributeId}::${value.code}`);
    const row = await put(
      'option_values',
      { id: current?.id ?? crypto.randomUUID() },
      {
        attribute_id: attributeId,
        code: value.code,
        label: value.label,
        description: value.description,
        image_media_id: media(value.imageMediaId),
        is_default: attribute.defaultValueCode === value.code,
        is_off: value.isOff,
        surcharge_minor: value.surchargeMinor,
        supplier_code: value.supplierCode,
        visual_token: value.visualToken,
        metadata: value.metadata,
        sort: value.sort,
        status: 'active',
        reference_only: value.referenceOnly,
      },
      current,
    );
    valueIds.set(valueKey(attribute.code, value.code), row.id as string);
  }

  // Materials (without product links yet), then products.
  const suppliers = new Set(
    (await query('SELECT id FROM suppliers')).map((row) => row.id as string),
  );
  const materialRows = await existing('materials');
  const materials = byCode(materialRows);
  const materialIds = new Map<string, string>();
  for (const material of snapshot.materials) {
    const current = materials.get(material.code);
    const values: Row = {
      code: material.code,
      name: material.name,
      status: 'active',
      supplier_id:
        material.supplier && suppliers.has(material.supplier.id) ? material.supplier.id : null,
      mill_name: material.millName,
      display_mill_name: material.displayMillName,
      collection_name: material.collection,
      season_code: material.seasonCode,
      colour_name: material.colourName,
      colour_family_code: material.colourFamily,
      primary_hex: material.primaryHex || null,
      secondary_hex: material.secondaryHex,
      pattern_code: material.pattern || null,
      weave_code: material.weave,
      texture_code: material.texture,
      sheen_code: material.sheen,
      finish_codes: material.finishes,
      composition: material.composition,
      weight_gsm: material.weightGsm,
      super_number: material.superNumber,
      yarn_count: material.yarnCount,
      width_cm: material.widthCm,
      stretch_code: material.stretch,
      season_codes: material.seasons,
      climate_codes: material.climates,
      occasion_codes: material.occasions,
      formality: material.formality,
      wrinkle_resistance: material.wrinkleResistance,
      breathability: material.breathability,
      opacity: material.opacity,
      drape: material.drape,
      care_codes: material.care,
      description_short: material.descriptionShort,
      story: material.story,
      tag_codes: material.tags,
      usages: material.usages,
      price_band_code: material.priceBand,
      texture_scale_cm: material.textureScaleCm,
      metadata: material.metadata,
      reference_only: material.referenceOnly,
    };
    // The article code travels with the supplier; without one it is left as it is.
    if (material.supplier) values.supplier_article_code = material.supplier.articleCode;
    const row = await put('materials', { id: current?.id ?? crypto.randomUUID() }, values, current);
    materialIds.set(material.code, row.id as string);
  }
  await archive('materials', materialRows, new Set(materialIds.values()));

  const productRows = await existing('products');
  const products = byCode(productRows);
  const productIds = new Map<string, string>();
  for (const product of snapshot.products) {
    const current = products.get(product.code);
    const row = await put(
      'products',
      { id: current?.id ?? crypto.randomUUID() },
      {
        code: product.code,
        name: product.name,
        short_label: product.shortLabel,
        description: product.description,
        measurement_set: product.measurementSet,
        visual_model: product.visualModel,
        default_material_id: materialIds.get(product.defaultMaterialCode) ?? null,
        hero_media_id: media(product.heroMediaId),
        sort: product.sort,
        status: 'active',
        reference_only: product.referenceOnly,
      },
      current,
    );
    productIds.set(product.code, row.id as string);
  }
  await archive('products', productRows, new Set(productIds.values()));
  const allProductIds = new Map([
    ...productRows.map((row) => [row.code as string, row.id as string] as const),
    ...productIds,
  ]);

  const snapshotProducts = new Set(productIds.values());
  await syncLinks(
    'product_components',
    'product_id',
    snapshotProducts,
    ['product_id', 'component_id'],
    snapshot.products.flatMap((product) =>
      product.components.map((link) => ({
        key: {
          product_id: productIds.get(product.code),
          component_id: componentIds.get(link.componentCode),
        },
        values: {
          required: link.required,
          default_included: link.defaultIncluded,
          surcharge_minor: link.surchargeMinor,
          include_label: link.includeLabel,
          sort: link.sort,
          metadata: link.metadata,
        },
      })),
    ),
  );
  await syncLinks(
    'product_band_prices',
    'product_id',
    snapshotProducts,
    ['product_id', 'band_code'],
    snapshot.products.flatMap((product) =>
      Object.entries(product.bandPrices).map(([band, price]) => ({
        key: { product_id: productIds.get(product.code), band_code: band },
        values: { price_minor: price },
      })),
    ),
  );
  const settingRows = await existing('product_option_settings');
  const settingId = new Map(
    settingRows.map((row) => [
      `${row.product_id}|${row.scope}|${row.group_id ?? row.attribute_id ?? row.value_id}`,
      row.id as string,
    ]),
  );
  const setting = (productId: string, scope: string, targetId: string, values: Row) => ({
    key: { id: settingId.get(`${productId}|${scope}|${targetId}`) ?? crypto.randomUUID() },
    values: {
      product_id: productId,
      scope,
      group_id: scope === 'group' ? targetId : null,
      attribute_id: scope === 'attribute' ? targetId : null,
      value_id: scope === 'value' ? targetId : null,
      default_value_id: null,
      ...values,
    },
  });
  await syncLinks(
    'product_option_settings',
    'product_id',
    snapshotProducts,
    ['id'],
    snapshot.products.flatMap((product) => {
      const productId = productIds.get(product.code)!;
      return [
        ...Object.entries(product.settings.groups).map(([code, value]) =>
          setting(productId, 'group', groupIds.get(code)!, {
            available: value.available,
            surcharge_override_minor: value.surchargeOverrideMinor,
          }),
        ),
        ...Object.entries(product.settings.attributes).map(([code, value]) =>
          setting(productId, 'attribute', attributeIds.get(code)!, {
            available: value.available,
            default_value_id: value.defaultValueCode
              ? (valueIds.get(valueKey(code, value.defaultValueCode)) ?? null)
              : null,
            surcharge_override_minor: value.surchargeOverrideMinor,
          }),
        ),
        ...Object.entries(product.settings.values).map(([key, value]) =>
          setting(productId, 'value', valueIds.get(key)!, {
            available: value.available,
            surcharge_override_minor: value.surchargeOverrideMinor,
          }),
        ),
      ];
    }),
  );

  const snapshotMaterials = new Set(materialIds.values());
  await syncLinks(
    'material_products',
    'material_id',
    snapshotMaterials,
    ['material_id', 'product_id'],
    snapshot.materials.flatMap((material) =>
      material.productCodes.map((code) => ({
        key: { material_id: materialIds.get(material.code), product_id: allProductIds.get(code) },
        values: {},
      })),
    ),
  );
  await syncLinks(
    'material_media',
    'material_id',
    snapshotMaterials,
    ['material_id', 'media_id'],
    snapshot.materials.flatMap((material) =>
      material.media.map((item) => ({
        key: { material_id: materialIds.get(material.code), media_id: media(item.mediaId) },
        values: { role: item.role, sort: item.sort },
      })),
    ),
  );
  await syncLinks(
    'material_price_overrides',
    'material_id',
    snapshotMaterials,
    ['material_id', 'product_id'],
    snapshot.materials.flatMap((material) =>
      Object.entries(material.priceOverrides).map(([code, price]) => ({
        key: { material_id: materialIds.get(material.code), product_id: allProductIds.get(code) },
        values: { price_minor: price },
      })),
    ),
  );

  // Rules and templates.
  const allAttributeIds = new Map([
    ...attributeRows.map((row) => [row.code as string, row.id as string] as const),
    ...attributeIds,
  ]);
  const ruleRows = await existing('compatibility_rules');
  const rules = byCode(ruleRows);
  const ruleIds = new Set<string>();
  for (const [position, rule] of snapshot.rules.entries()) {
    const attributeId = allAttributeIds.get(rule.attributeCode);
    if (!attributeId) throw new Error(`Rule ${rule.code} targets an unknown option.`);
    const current = rules.get(rule.code);
    const row = await put(
      'compatibility_rules',
      { id: current?.id ?? crypto.randomUUID() },
      {
        code: rule.code,
        name: rule.name,
        product_ids: rule.productCodes.map((code) => allProductIds.get(code) ?? code),
        when_condition: rule.when,
        effect: rule.effect,
        attribute_id: attributeId,
        value_ids: rule.valueCodes.map(
          (code) => valueIds.get(valueKey(rule.attributeCode, code)) ?? code,
        ),
        customer_message: rule.message,
        sort: position,
        status: 'active',
      },
      current,
    );
    ruleIds.add(row.id as string);
  }
  await archive('compatibility_rules', ruleRows, ruleIds);

  const templateRows = await existing('templates');
  const templates = byCode(templateRows);
  const templateIds = new Map<string, string>();
  for (const template of snapshot.templates) {
    const current = templates.get(template.code);
    const row = await put(
      'templates',
      { id: current?.id ?? crypto.randomUUID() },
      {
        code: template.code,
        product_id: allProductIds.get(template.productCode),
        material_id: materialIds.get(template.materialCode),
        name: template.name,
        subtitle: template.subtitle,
        description: template.description,
        story: template.story,
        included_components: template.includedComponents,
        selections: template.selections,
        occasion_codes: template.occasions,
        climate_codes: template.climates,
        featured: template.featured,
        sort: template.sort,
        status: 'active',
        reference_only: template.referenceOnly,
      },
      current,
    );
    templateIds.set(template.code, row.id as string);
  }
  await archive('templates', templateRows, new Set(templateIds.values()));
  await syncLinks(
    'template_media',
    'template_id',
    new Set(templateIds.values()),
    ['template_id', 'media_id'],
    snapshot.templates.flatMap((template) => [
      ...(template.heroMediaId
        ? [
            {
              key: {
                template_id: templateIds.get(template.code),
                media_id: media(template.heroMediaId),
              },
              values: { role: 'hero', sort: 0 },
            },
          ]
        : []),
      ...template.galleryMediaIds.map((id, i) => ({
        key: { template_id: templateIds.get(template.code), media_id: media(id) },
        values: { role: 'gallery', sort: i + 1 },
      })),
    ]),
  );

  const totals = Object.values(byTable).reduce<LoadCounts>(
    (sum, item) => ({
      created: sum.created + item.created,
      updated: sum.updated + item.updated,
      archived: sum.archived + item.archived,
      deleted: sum.deleted + item.deleted,
    }),
    { created: 0, updated: 0, archived: 0, deleted: 0 },
  );
  const changed = totals.created + totals.updated + totals.archived + totals.deleted > 0;
  if (changed)
    await writeAudit(query, {
      actor,
      action: 'catalog.working_copy_loaded',
      entityType: 'catalog',
      summary: {
        fields: Object.keys(byTable).sort(),
        after: { ...totals, snapshotVersion: snapshot.version },
      },
    });
  return { ...totals, byTable, changed };
}
