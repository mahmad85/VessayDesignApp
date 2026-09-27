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
} from 'drizzle-orm/pg-core';
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
    sourceDimensions: jsonb('source_dimensions').$type<
      Array<{ section: string; label: string; value: number }>
    >(),
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
