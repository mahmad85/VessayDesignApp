import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  uniqueIndex,
  serial,
  index,
  numeric,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { Draft } from '@/modules/configuration/types';
export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export const session = pgTable('session', {
  id: text().primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});
export const account = pgTable('account', {
  id: text().primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text(),
  password: text(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export const verification = pgTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export const rateLimit = pgTable('rate_limit', {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
export const drafts = pgTable(
  'drafts',
  {
    id: text().primaryKey(),
    owner: text().notNull(),
    revision: integer().notNull(),
    data: jsonb().$type<Draft>().notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('drafts_owner_unique').on(t.owner)],
);
export const actions = pgTable('actions', {
  id: text().primaryKey(),
  draftId: text('draft_id')
    .notNull()
    .references(() => drafts.id, { onDelete: 'cascade' }),
  fingerprint: text().notNull(),
  result: jsonb().$type<Draft>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
export const revisions = pgTable(
  'revisions',
  {
    id: text().primaryKey(),
    draftId: text('draft_id')
      .notNull()
      .references(() => drafts.id, { onDelete: 'cascade' }),
    revision: integer().notNull(),
    data: jsonb().$type<Draft>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('revisions_draft_version').on(t.draftId, t.revision)],
);
export const requestLimits = pgTable('request_limits', {
  key: text().primaryKey(),
  count: integer().notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});

// 3DLOOK SAIA measurement capture (docs/integrations/3DLOOK.md, INT-001..INT-005).
// A draft here is a review-required capture result, kept apart from the
// customer's confirmed measurements until they explicitly accept it.
export const saiaMeasurementDrafts = pgTable(
  'saia_measurement_drafts',
  {
    id: serial().primaryKey(),
    ownerId: text('owner_id').notNull(),
    entitlementId: integer('entitlement_id'),
    captureToken: text('capture_token').notNull(),
    providerPersonId: text('provider_person_id'),
    status: text().notNull().default('pending'),
    targetUnit: text('target_unit').notNull().default('cm'),
    measurements: jsonb().$type<Record<string, number>>(),
    sourceDimensions:
      jsonb('source_dimensions').$type<Array<{ section: string; label: string; value: number }>>(),
    errorCode: text('error_code'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('saia_drafts_capture_token_unique').on(t.captureToken),
    uniqueIndex('saia_drafts_owner_person_unique').on(t.ownerId, t.providerPersonId),
  ],
);
// Immutable audit trail of every raw provider result, kept separate from the
// mapped/edited values (INT-004: "Preserve original results separately from
// user edits").
export const measurementSourceSnapshots = pgTable('measurement_source_snapshots', {
  id: serial().primaryKey(),
  ownerId: text('owner_id').notNull(),
  source: text().notNull(),
  sourceMetadata: jsonb('source_metadata').$type<Record<string, unknown>>().notNull(),
  rawDimensions: jsonb('raw_dimensions')
    .$type<Array<{ section: string; label: string; value: number }>>()
    .notNull(),
  canonicalDimensions: jsonb('canonical_dimensions').$type<Record<string, number>>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
// Paid single-use AI scan entitlement ledger. Fails closed (see
// providerScanAuthorizationReadiness in scan-service-policy.ts) until 3DLOOK
// supplies a private, single-use scan-authorization capability; no live
// Stripe charge is ever created before that boundary exists.
// Status columns are plain text (not pg enums) to match this schema's
// existing style and keep the hand-written SQL migrations simple statements.
export const scanServicePayments = pgTable(
  'scan_service_payments',
  {
    id: serial().primaryKey(),
    ownerId: text('owner_id').notNull(),
    draftId: text('draft_id').notNull(),
    revision: integer().notNull(),
    checkoutKey: text('checkout_key').notNull(),
    checkoutFingerprint: text('checkout_fingerprint').notNull(),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    status: text().notNull().default('payment_pending'),
    amountCents: integer('amount_cents').notNull(),
    currency: text().notNull().default('usd'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('scan_payments_owner_checkout_unique').on(t.ownerId, t.checkoutKey),
    uniqueIndex('scan_payments_intent_unique').on(t.stripePaymentIntentId),
  ],
);
export const scanEntitlements = pgTable(
  'scan_entitlements',
  {
    id: serial().primaryKey(),
    ownerId: text('owner_id').notNull(),
    paymentId: integer('payment_id').notNull(),
    draftId: text('draft_id').notNull(),
    revision: integer().notNull(),
    status: text().notNull().default('authorized'),
    retryCount: integer('retry_count').notNull().default(0),
    grantedByAdminId: text('granted_by_admin_id'),
    consumedAt: timestamp('consumed_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('scan_entitlements_payment_unique').on(t.paymentId)],
);
export const garmentCredits = pgTable(
  'garment_credits',
  {
    id: serial().primaryKey(),
    ownerId: text('owner_id').notNull(),
    paymentId: integer('payment_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text().notNull().default('usd'),
    status: text().notNull().default('available'),
    reservationKey: text('reservation_key'),
    reservedOrderId: text('reserved_order_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('garment_credits_payment_unique').on(t.paymentId)],
);
export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  id: text().primaryKey(),
  eventType: text('event_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
export const scanAttemptEvents = pgTable('scan_attempt_events', {
  id: serial().primaryKey(),
  entitlementId: integer('entitlement_id').notNull(),
  ownerId: text('owner_id').notNull(),
  eventType: text('event_type').notNull(),
  actorId: text('actor_id').notNull(),
  metadata: jsonb().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Catalog, media, suppliers, releases and audit (migrations/0003_catalog.sql,
// ADMIN-BACKEND.md §4.1). The SQL migration is authoritative: its CHECK
// constraints are enforced by PostgreSQL and covered by tests/migrations.test.ts,
// and are not repeated here. tests/migrations.test.ts also checks that these
// columns, types, nullability and primary keys match the migrated database.
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const rowVersion = () => integer('row_version').notNull().default(1);
const status = () => text().notNull().default('draft');
const textList = (name: string) =>
  text(name)
    .array()
    .notNull()
    .default(sql`'{}'`);
export type JsonRecord = Record<string, unknown>;

export const auditEvents = pgTable(
  'audit_events',
  {
    id: text().primaryKey(),
    actor: text().notNull(),
    action: text().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    summary: jsonb().$type<JsonRecord>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_events_entity_idx').on(t.entityType, t.entityId, t.createdAt),
    index('audit_events_created_idx').on(t.createdAt),
  ],
);
export const lookupTypes = pgTable('lookup_types', {
  code: text().primaryKey(),
  label: text().notNull(),
  description: text().notNull().default(''),
  system: boolean().notNull().default(false),
  valueMetadataSchema: jsonb('value_metadata_schema').$type<unknown[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const lookupValues = pgTable(
  'lookup_values',
  {
    id: text().primaryKey(),
    typeCode: text('type_code')
      .notNull()
      .references(() => lookupTypes.code),
    code: text().notNull(),
    label: text().notNull(),
    description: text().notNull().default(''),
    sort: integer().notNull().default(0),
    active: boolean().notNull().default(true),
    metadata: jsonb().$type<JsonRecord>().notNull().default({}),
    firstPublishedVersion: integer('first_published_version'),
    rowVersion: rowVersion(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.typeCode, t.code)],
);
export const suppliers = pgTable('suppliers', {
  id: text().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
  legalName: text('legal_name'),
  kind: text().notNull(),
  status: text().notNull().default('active'),
  website: text(),
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: text(),
  region: text(),
  postalCode: text('postal_code'),
  countryCode: text('country_code'),
  defaultLeadTimeDays: integer('default_lead_time_days'),
  capabilities: textList('capabilities'),
  notes: text().notNull().default(''),
  rowVersion: rowVersion(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const supplierContacts = pgTable(
  'supplier_contacts',
  {
    id: text().primaryKey(),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    rank: text().notNull(),
    name: text().notNull(),
    roleTitle: text('role_title'),
    email: text(),
    phone: text(),
    preferredChannel: text('preferred_channel'),
    notes: text().notNull().default(''),
    rowVersion: rowVersion(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.supplierId, t.rank)],
);
export const mediaAssets = pgTable(
  'media_assets',
  {
    id: text().primaryKey(),
    storageDriver: text('storage_driver').notNull(),
    storageKey: text('storage_key').notNull(),
    contentType: text('content_type').notNull(),
    bytes: integer().notNull(),
    width: integer(),
    height: integer(),
    sha256: text().notNull(),
    altText: text('alt_text').notNull().default(''),
    rightsStatus: text('rights_status').notNull().default('unknown'),
    sourceNote: text('source_note').notNull().default(''),
    createdBy: text('created_by').notNull(),
    rowVersion: rowVersion(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.storageDriver, t.storageKey)],
);
export const priceBands = pgTable('price_bands', {
  code: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull().default(''),
  sort: integer().notNull().default(0),
  firstPublishedVersion: integer('first_published_version'),
  rowVersion: rowVersion(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const materials = pgTable('materials', {
  id: text().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
  status: status(),
  supplierId: text('supplier_id').references(() => suppliers.id),
  supplierArticleCode: text('supplier_article_code'),
  millName: text('mill_name'),
  displayMillName: boolean('display_mill_name').notNull().default(false),
  collectionName: text('collection_name'),
  seasonCode: text('season_code'),
  colourName: text('colour_name'),
  colourFamilyCode: text('colour_family_code'),
  primaryHex: text('primary_hex'),
  secondaryHex: text('secondary_hex'),
  patternCode: text('pattern_code'),
  weaveCode: text('weave_code'),
  textureCode: text('texture_code'),
  sheenCode: text('sheen_code'),
  finishCodes: textList('finish_codes'),
  composition: jsonb().$type<{ fibre: string; percent: number }[]>().notNull().default([]),
  weightGsm: integer('weight_gsm'),
  superNumber: integer('super_number'),
  yarnCount: text('yarn_count'),
  widthCm: integer('width_cm'),
  stretchCode: text('stretch_code'),
  seasonCodes: textList('season_codes'),
  climateCodes: textList('climate_codes'),
  occasionCodes: textList('occasion_codes'),
  formality: integer(),
  wrinkleResistance: text('wrinkle_resistance'),
  breathability: text(),
  opacity: text(),
  drape: text(),
  careCodes: textList('care_codes'),
  descriptionShort: text('description_short').notNull().default(''),
  story: text().notNull().default(''),
  tagCodes: textList('tag_codes'),
  usages: textList('usages'),
  priceBandCode: text('price_band_code').references(() => priceBands.code),
  availability: text().notNull().default('unknown'),
  stockMeters: numeric('stock_meters', { precision: 10, scale: 2 }),
  leadTimeDays: integer('lead_time_days'),
  availabilityUpdatedAt: timestamp('availability_updated_at', { withTimezone: true }),
  textureScaleCm: numeric('texture_scale_cm', { precision: 6, scale: 2 }),
  metadata: jsonb().$type<JsonRecord>().notNull().default({}),
  referenceOnly: boolean('reference_only').notNull().default(false),
  firstPublishedVersion: integer('first_published_version'),
  rowVersion: rowVersion(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const products = pgTable('products', {
  id: text().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
  shortLabel: text('short_label').notNull(),
  description: text().notNull().default(''),
  measurementSet: text('measurement_set').notNull(),
  visualModel: text('visual_model').notNull(),
  defaultMaterialId: text('default_material_id').references(() => materials.id),
  heroMediaId: text('hero_media_id').references(() => mediaAssets.id),
  fabricConsumptionCm: integer('fabric_consumption_cm'),
  sort: integer().notNull().default(0),
  status: status(),
  referenceOnly: boolean('reference_only').notNull().default(false),
  firstPublishedVersion: integer('first_published_version'),
  rowVersion: rowVersion(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const materialProducts = pgTable(
  'material_products',
  {
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
  },
  (t) => [primaryKey({ columns: [t.materialId, t.productId] })],
);
export const materialMedia = pgTable(
  'material_media',
  {
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    mediaId: text('media_id')
      .notNull()
      .references(() => mediaAssets.id),
    role: text().notNull(),
    sort: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.materialId, t.mediaId] })],
);
export const materialPriceOverrides = pgTable(
  'material_price_overrides',
  {
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    priceMinor: integer('price_minor').notNull(),
    rowVersion: rowVersion(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.materialId, t.productId] })],
);
export const productBandPrices = pgTable(
  'product_band_prices',
  {
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    bandCode: text('band_code')
      .notNull()
      .references(() => priceBands.code),
    priceMinor: integer('price_minor').notNull(),
    rowVersion: rowVersion(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.bandCode] })],
);
export const components = pgTable('components', {
  id: text().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(''),
  visualPart: text('visual_part').notNull(),
  sort: integer().notNull().default(0),
  status: status(),
  referenceOnly: boolean('reference_only').notNull().default(false),
  firstPublishedVersion: integer('first_published_version'),
  rowVersion: rowVersion(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const productComponents = pgTable(
  'product_components',
  {
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    required: boolean().notNull().default(true),
    defaultIncluded: boolean('default_included').notNull().default(true),
    surchargeMinor: integer('surcharge_minor').notNull().default(0),
    includeLabel: text('include_label'),
    sort: integer().notNull().default(0),
    metadata: jsonb().$type<JsonRecord>().notNull().default({}),
    rowVersion: rowVersion(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.componentId] })],
);
export const optionGroups = pgTable(
  'option_groups',
  {
    id: text().primaryKey(),
    code: text().notNull().unique(),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    name: text().notNull(),
    shortName: text('short_name').notNull(),
    description: text().notNull().default(''),
    kind: text().notNull(),
    lineKind: text('line_kind').notNull().default('construction'),
    iconMediaId: text('icon_media_id').references(() => mediaAssets.id),
    focusRegion: text('focus_region'),
    surchargeMinor: integer('surcharge_minor').notNull().default(0),
    visibleWhen: jsonb('visible_when').$type<unknown>(),
    metadata: jsonb().$type<JsonRecord>().notNull().default({}),
    sort: integer().notNull().default(0),
    status: status(),
    referenceOnly: boolean('reference_only').notNull().default(false),
    firstPublishedVersion: integer('first_published_version'),
    rowVersion: rowVersion(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('option_groups_component_idx').on(t.componentId, t.sort)],
);
export const attributes = pgTable(
  'attributes',
  {
    id: text().primaryKey(),
    code: text().notNull().unique(),
    groupId: text('group_id')
      .notNull()
      .references(() => optionGroups.id),
    name: text().notNull(),
    helpText: text('help_text').notNull().default(''),
    inputType: text('input_type').notNull(),
    required: boolean().notNull().default(true),
    textRules: jsonb('text_rules').$type<JsonRecord>(),
    visualSlot: text('visual_slot'),
    metadataFields: jsonb('metadata_fields').$type<unknown[]>().notNull().default([]),
    surchargeMinor: integer('surcharge_minor').notNull().default(0),
    visibleWhen: jsonb('visible_when').$type<unknown>(),
    legacyKey: text('legacy_key'),
    sort: integer().notNull().default(0),
    status: status(),
    referenceOnly: boolean('reference_only').notNull().default(false),
    firstPublishedVersion: integer('first_published_version'),
    rowVersion: rowVersion(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('attributes_group_idx').on(t.groupId, t.sort)],
);
export const optionValues = pgTable(
  'option_values',
  {
    id: text().primaryKey(),
    attributeId: text('attribute_id')
      .notNull()
      .references(() => attributes.id),
    code: text().notNull(),
    label: text().notNull(),
    description: text().notNull().default(''),
    imageMediaId: text('image_media_id').references(() => mediaAssets.id),
    isDefault: boolean('is_default').notNull().default(false),
    isOff: boolean('is_off').notNull().default(false),
    surchargeMinor: integer('surcharge_minor').notNull().default(0),
    supplierCode: text('supplier_code'),
    visualToken: text('visual_token'),
    metadata: jsonb().$type<JsonRecord>().notNull().default({}),
    sort: integer().notNull().default(0),
    status: status(),
    referenceOnly: boolean('reference_only').notNull().default(false),
    firstPublishedVersion: integer('first_published_version'),
    rowVersion: rowVersion(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.attributeId, t.code),
    uniqueIndex('option_values_one_default')
      .on(t.attributeId)
      .where(sql`${t.isDefault} AND ${t.status} <> 'archived'`),
  ],
);
export const productOptionSettings = pgTable(
  'product_option_settings',
  {
    id: text().primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    scope: text().notNull(),
    groupId: text('group_id').references(() => optionGroups.id),
    attributeId: text('attribute_id').references(() => attributes.id),
    valueId: text('value_id').references(() => optionValues.id),
    available: boolean().notNull().default(true),
    defaultValueId: text('default_value_id').references(() => optionValues.id),
    surchargeOverrideMinor: integer('surcharge_override_minor'),
    rowVersion: rowVersion(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('product_option_settings_target').on(
      t.productId,
      t.scope,
      sql`(coalesce(${t.groupId}, ${t.attributeId}, ${t.valueId}))`,
    ),
  ],
);
export const compatibilityRules = pgTable('compatibility_rules', {
  id: text().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
  productIds: textList('product_ids'),
  whenCondition: jsonb('when_condition').$type<unknown>().notNull(),
  effect: text().notNull(),
  attributeId: text('attribute_id')
    .notNull()
    .references(() => attributes.id),
  valueIds: text('value_ids').array().notNull(),
  customerMessage: text('customer_message').notNull(),
  sort: integer().notNull().default(0),
  status: status(),
  firstPublishedVersion: integer('first_published_version'),
  rowVersion: rowVersion(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const templates = pgTable('templates', {
  id: text().primaryKey(),
  code: text().notNull().unique(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  materialId: text('material_id')
    .notNull()
    .references(() => materials.id),
  name: text().notNull(),
  subtitle: text().notNull().default(''),
  description: text().notNull().default(''),
  story: text().notNull().default(''),
  includedComponents: textList('included_components'),
  selections: jsonb().$type<Record<string, string>>().notNull().default({}),
  occasionCodes: textList('occasion_codes'),
  climateCodes: textList('climate_codes'),
  featured: boolean().notNull().default(false),
  sort: integer().notNull().default(0),
  status: status(),
  referenceOnly: boolean('reference_only').notNull().default(false),
  firstPublishedVersion: integer('first_published_version'),
  rowVersion: rowVersion(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const templateMedia = pgTable(
  'template_media',
  {
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    mediaId: text('media_id')
      .notNull()
      .references(() => mediaAssets.id),
    role: text().notNull(),
    sort: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.mediaId] })],
);
export const catalogReleases = pgTable('catalog_releases', {
  version: integer().primaryKey(),
  id: text().notNull().unique(),
  snapshot: jsonb().$type<JsonRecord>().notNull(),
  checksum: text().notNull(),
  referenceOnly: boolean('reference_only').notNull(),
  notes: text().notNull().default(''),
  validation: jsonb().$type<JsonRecord>().notNull().default({}),
  restoredFromVersion: integer('restored_from_version'),
  publishedBy: text('published_by').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});
export const commerceSettings = pgTable('commerce_settings', {
  id: text().primaryKey(),
  currency: text().notNull().default('USD'),
  shippingFlatMinor: integer('shipping_flat_minor').notNull().default(0),
  shipCountries: text('ship_countries')
    .array()
    .notNull()
    .default(sql`'{US}'`),
  quoteTtlMinutes: integer('quote_ttl_minutes').notNull().default(10080),
  orderNumberPrefix: text('order_number_prefix').notNull().default('VS'),
  opsTimezone: text('ops_timezone').notNull().default('UTC'),
  rowVersion: rowVersion(),
  updatedBy: text('updated_by'),
  updatedAt: updatedAt(),
});
