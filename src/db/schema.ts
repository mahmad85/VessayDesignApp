import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  uniqueIndex,
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
