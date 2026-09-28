# Backend design: catalog admin, pricing, cart, orders, suppliers and staff

Status: proposed v0.3 technical contract under D-019 (2026-09-28). Owns the module layout, the database DDL, the internal contracts (catalog snapshot, draft v2, order snapshot), authorisation, caching, storage and the provider adapters for TASK-015 to TASK-026. Domain meaning is owned by [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md), [PRICING.md](../domain/PRICING.md) and [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md). Endpoints are in [API-REFERENCE.md](API-REFERENCE.md). The as-is baseline is in [CURRENT-SYSTEM.md](CURRENT-SYSTEM.md).

Stack constraints (ADR-010, SECURITY-RELEASE.md OPS-001): the same Next.js 16 / TypeScript 6 / PostgreSQL / Drizzle / Better Auth / Zod stack. **No new runtime dependency** is needed for TASK-015 to TASK-025. Better Auth’s `twoFactor` plugin ships inside the installed `better-auth@1.7.6`, and `stripe@22.6.2` is already installed. The only dependency-bearing item is the production object-storage driver (TASK-026, Q-024), which needs explicit approval.

## 1. Module layout

```
src/
  lib/
    canonical-json.ts        stable key-sorted JSON + sha256 checksum
    money.ts                 parseMoney('1299.00') -> 129900, formatting helpers, currency allowlist
    http.ts                  (existing) + body(request, {maxBytes}) option, failure() adds details for validation
  modules/
    catalog/
      snapshot.ts            Zod schemas + types for CatalogSnapshot and CustomerCatalog (section 5)
      conditions.ts          evaluateCondition(cond, ctx), validateCondition(cond, index)
      structure.ts           defaultsFor, effectiveSelections, visibleStructure (tabs/groups/attributes/values)
      garment.ts             validateGarment, applyGarmentPatch (returns {garment, impact[]}), rebaseGarment
      compile.ts             compileWorkingCopy(rows) -> CatalogSnapshot (pure)
      validate-release.ts    validateRelease(snapshot) -> {errors[], warnings[]} (CATALOG-ADMIN 7.4)
      projection.ts          toCustomerCatalog(snapshot)
      diff.ts                diffSnapshots(a, b)
      import-legacy.ts       importLegacyCatalog(...) -> CatalogSnapshot (CATALOG-ADMIN 10), plus lookup seeds
      catalog.ts, suit-customization.ts, *.seed.json   (existing; kept as import sources only after TASK-016)
    pricing/quote.ts         quoteGarment, quoteCart (PRICING.md) - the only price calculator
    pricing/explain.ts       plain-language charge explanations shown in the admin (PRC-003 wording)
    configuration/
      types.ts               DraftV2, Garment, GarmentPatch, commandSchemaV2, DomainError (existing class kept)
      upgrade.ts             upgradeDraft(v1|v2) -> DraftV2 (section 7.2), pure and deterministic
      engine.ts              createDraft, applyCommand (v2)
      design-outline.ts      designOutline(snapshot, garment) (rewritten to read the snapshot, same output shape)
    measurements/definitions.ts  (existing) + requiredDefinitionsForProducts(sets[])
    review/review.ts         reviewDraft (v2: per garment findings); superseded by orders/check-policy.ts in TASK-023
    orders/
      submission.ts          buildOrderSnapshot, submission checks (ORDERS-FULFILLMENT 2)
      check-policy.ts        check-policy-v1: deterministic blocking and advice findings (ORDERS-FULFILLMENT 2.1)
      tailor-review.ts       tailor-review state machine, decision and customer-response validation (D-020)
      fulfillment.ts         transition table + deriveOrderFulfillment
      customer-status.ts     customer labels (FUL-004)
    staff/permissions.ts     ROLE_PERMISSIONS, hasPermission
    staff/authorize.ts       getStaffContext(headers), requireStaff(request, permission)
    notifications/dispatch.ts  send pending notifications through integrations/mail.ts
  db/
    client.ts                (existing) MIGRATIONS gains 0003-0006
    schema.ts                (existing) + Drizzle tables for every new table
    catalog-admin-repository.ts   working-copy CRUD with row_version and audit
    release-repository.ts    publish, getCurrentVersion, getRelease (cached), restoreToWorkingCopy
    availability.ts          live material availability overlay (60 s cache)
    repository.ts            (existing drafts) + upgrade on read, v2 commands, preview owner
    order-repository.ts      check result save, submit, resubmit, cancel, tailor reviews and amendments, fulfilment, events, notifications
    payment-repository.ts    payments rows + reconciliation transactions
    supplier-repository.ts   suppliers and contacts
    staff-repository.ts      staff_roles grants
    audit.ts                 writeAudit(query, event)
    media-repository.ts      media_assets
  integrations/
    storage/index.ts         StorageProvider + getStorage() (local | static | object_store)
    storage/local.ts, storage/static.ts   (object_store.ts in TASK-026)
    payments/stripe-orders.ts  PaymentProvider implementation (section 10)
    payments/fake.ts         test-only provider, throws when NODE_ENV === 'production'
    assistant.ts             (existing) grounded in the release (section 11)
  visualization/
    registry.ts              VISUAL_SLOTS, REGION_IDS (CATALOG-ADMIN 6)
    binding.ts               renderValues(snapshot, garment)
  app/
    admin/security/page.tsx          MFA enrolment (staff without MFA may reach this)
    admin/(guarded)/layout.tsx       staff guard (section 3.4)
    admin/(guarded)/**/page.tsx      ADMIN-SCREENS.md
    orders/page.tsx, orders/[number]/page.tsx   customer orders
    api/admin/**, api/catalog/**, api/orders/**, api/media/[id], api/payments/stripe/webhook
scripts/
  catalog-bootstrap.ts       import + publish v1 (idempotent)
  staff-grant.ts             grant or revoke a role for an existing verified user
```

Route handlers stay thin: parse → authorise → call one module or repository function → `json()`. Business rules live in `src/modules`. SQL lives in `src/db` (AGENTS.md).

## 2. Conventions

| Topic | Rule |
| --- | --- |
| Ids | `text` UUID v4 from `crypto.randomUUID()`. Exceptions: `catalog_releases.version` (int), `orders.number` (formatted sequence), `price_bands.code`, `lookup_types.code` |
| Timestamps | New tables use `timestamptz`. Existing tables are unchanged |
| Money | `integer` minor units, suffix `_minor`, with an explicit `currency` (PRICING.md PRC-001) |
| Codes | Machine keys. Catalog codes match `^[a-z0-9]+(?:[._-][a-z0-9]+)*$` (length 1–180). Option value codes match `^[A-Za-z0-9](?:[A-Za-z0-9 _.-]{0,78}[A-Za-z0-9])?$`, to keep imported values such as `A1` and `By default`. Template codes are URL slugs `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| Enumerations | `text` + `CHECK (… IN (…))`, matching the existing style (no PG enums) |
| Optimistic concurrency | Mutable admin rows have `row_version integer NOT NULL DEFAULT 1`. Updates use `WHERE id=$1 AND row_version=$2` and increment it. No row returns 409 `stale_row_version` with `details.current` (the current row), or 404 if the row is missing |
| Idempotency | Customer commands keep `actionId` + fingerprint (existing). Order submit, resubmit, cancel, checkout and publish take an `actionId` and store it uniquely. Admin creates rely on unique codes |
| Audit | Every admin mutation writes `audit_events` in the **same transaction**: `actor` (`user:<id>` or `system:<name>`), `action` (`<entity>.<verb>`), `entity_type`, `entity_id`, and `summary` = `{fields: string[], before?: {...}, after?: {...}}`, with only non-personal scalar fields. Supplier contact values and customer data are never copied into audit summaries |
| Errors | `{error: {code, message, details?}}`. `details` is optional: `{fields?: [{path, message}], current?, impact?, quote?, report?}`. A `ZodError` on admin routes returns 422 `validation_failed` with `details.fields` from the issue paths. Customer routes keep today’s generic `invalid_input` message |
| Body limits | `body(request, {maxBytes})`: customer default 20,000 (unchanged); admin JSON 100,000; bulk endpoints 500,000; media upload 5,242,880 through a streaming multipart reader |
| Caching headers | Everything is `no-store` except `/api/catalog/v/{version}` and `/api/media/{id}`, which are `public, max-age=31536000, immutable` (non-sensitive and immutable) |
| Rate limits | `enforceLimit`: admin mutations 300/min per staff user; publish 10/min; media upload 60/min; order submit 10/min per owner; checkout 10/min per owner; webhook not limited (signature required) |

## 3. Staff identity and authorisation (ADM-001, ADM-002; AUTH-004, SEC-001, UX-012, AC-18, AC-31)

### 3.1 Roles and permissions

Roles are application-owned (`staff_roles`), never taken from the client and never Better Auth’s `admin` plugin role. A user may hold several roles.

| Permission | owner | catalog_manager | order_manager | tailor | support |
| --- | --- | --- | --- | --- | --- |
| `catalog.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `catalog.write` (products, parts, groups, options, choices, rules, lookups, fabrics, templates, media, bands and prices) | ✓ | ✓ | | | |
| `catalog.publish` (publish, restore, clear `reference_only`) | ✓ | ✓ | | | |
| `settings.write` (commerce settings) | ✓ | | | | |
| `suppliers.read` | ✓ | ✓ | ✓ | | |
| `suppliers.write` | ✓ | ✓ | ✓ | | |
| `orders.read` (orders, items, spec, events) | ✓ | | ✓ | ✓ | ✓ |
| `orders.measurements.read` (body values in specs and sheets) | ✓ | | ✓ | ✓ | |
| `orders.fulfillment.write` (assign, deadline, status, tracking, ETA) | ✓ | | ✓ | | |
| `orders.hold` (put on hold) | ✓ | | ✓ | ✓ | |
| `orders.notes.write` | ✓ | | ✓ | ✓ | ✓ |
| `orders.notifications.retry` | ✓ | | ✓ | | ✓ |
| `reviews.read` | ✓ | | ✓ | ✓ | |
| `reviews.decide` | ✓ | | | ✓ | |
| `customers.read` (account and order lookup, draft summary without measurements) | ✓ | | ✓ | | ✓ |
| `staff.manage` | ✓ | | | | |
| `audit.read` | ✓ | | | | |

`support` never receives measurement values, provider snapshots or body photos (PRD users). Support views redact `spec.measurements`, and the production sheet requires `orders.measurements.read`.

### 3.2 MFA (AUTH-004)

Enable Better Auth `twoFactor` (TOTP with backup codes) in `src/lib/auth.ts`, with `issuer: 'Vessy'`, and add its client plugin to the account UI. Required schema: migration `0004` (§4.2). `mfaRequired()` = `NODE_ENV === 'production' || process.env.STAFF_MFA_REQUIRED === 'true'`, and it cannot be disabled in production. When MFA is required, a staff user without `two_factor_enabled` can reach only `/admin/security` (enrolment) and `GET /api/admin/me`. Everything else returns 403 `mfa_required`. Customer MFA stays optional and is not built in this scope.

### 3.3 Bootstrap and grants

- The first owner is granted only by an operator with shell access: `npm run staff:grant -- --email <verified user email> --role owner`. The script refuses unverified users and writes an audit event with actor `system:cli`.
- Owners grant and revoke roles in ADM-17 for **existing verified accounts** only. An owner cannot revoke their own `owner` role if they are the last owner (409 `last_owner`).

### 3.4 Guards

- API: `requireStaff(request, permission)` loads the Better Auth session (401 `sign_in_required`), loads the roles (403 `forbidden` when there are none), checks MFA (403 `mfa_required`) and checks the permission (403 `forbidden`). It returns `{userId, actor: 'user:<id>', roles, permissions}`. Every `/api/admin/**` mutation also calls `checkOrigin`.
- Pages: `src/app/admin/(guarded)/layout.tsx` is a server component. It uses `headers()` to call `getStaffContext`. It redirects to `/account?next=/admin` when there is no session, calls `notFound()` for non-staff (so it does not reveal the admin area), and redirects to `/admin/security` when MFA is missing. The guard in the layout is a UX convenience only: every handler still authorises (Next.js “Data Access Layer” guidance; do not rely on `proxy.ts`).
- Preview: `GET /api/studio?catalog=working` requires `catalog.read` and uses owner `preview:user:<id>`.

## 4. Database DDL

Four migrations, assigned to tasks. Each file is **idempotent** and **free of semicolons inside statements** (CURRENT-SYSTEM.md, migration mechanics). There are no SQL comments inside the files. Add the names to `MIGRATIONS` and mirror every table in `src/db/schema.ts`. If tasks merge out of order, renumber before merge, and never renumber a deployed file.

### 4.1 `0003_catalog.sql` (TASK-015)

```sql
CREATE TABLE IF NOT EXISTS audit_events (id text PRIMARY KEY, actor text NOT NULL, action text NOT NULL, entity_type text NOT NULL, entity_id text, summary jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events(created_at);
CREATE TABLE IF NOT EXISTS lookup_types (code text PRIMARY KEY, label text NOT NULL, description text NOT NULL DEFAULT '', system boolean NOT NULL DEFAULT false, value_metadata_schema jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS lookup_values (id text PRIMARY KEY, type_code text NOT NULL REFERENCES lookup_types(code), code text NOT NULL, label text NOT NULL, description text NOT NULL DEFAULT '', sort integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, first_published_version integer, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (type_code, code));
CREATE TABLE IF NOT EXISTS suppliers (id text PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, legal_name text, kind text NOT NULL CHECK (kind IN ('fabric_mill','fabric_merchant','manufacturer','accessory','other')), status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')), website text, address_line1 text, address_line2 text, city text, region text, postal_code text, country_code text CHECK (country_code ~ '^[A-Z]{2}$'), default_lead_time_days integer CHECK (default_lead_time_days BETWEEN 0 AND 365), capabilities text[] NOT NULL DEFAULT '{}', notes text NOT NULL DEFAULT '', row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS supplier_contacts (id text PRIMARY KEY, supplier_id text NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE, rank text NOT NULL CHECK (rank IN ('primary','secondary')), name text NOT NULL, role_title text, email text, phone text, preferred_channel text CHECK (preferred_channel IN ('email','phone')), notes text NOT NULL DEFAULT '', row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (supplier_id, rank));
CREATE TABLE IF NOT EXISTS media_assets (id text PRIMARY KEY, storage_driver text NOT NULL CHECK (storage_driver IN ('local','object_store','static')), storage_key text NOT NULL, content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp','image/svg+xml')), bytes integer NOT NULL CHECK (bytes > 0), width integer, height integer, sha256 text NOT NULL, alt_text text NOT NULL DEFAULT '', rights_status text NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('owned','licensed','supplier_provided','reference_only','unknown')), source_note text NOT NULL DEFAULT '', created_by text NOT NULL, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (storage_driver, storage_key));
CREATE TABLE IF NOT EXISTS price_bands (code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{1,8}$'), name text NOT NULL, description text NOT NULL DEFAULT '', sort integer NOT NULL DEFAULT 0, first_published_version integer, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS materials (id text PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')), supplier_id text REFERENCES suppliers(id), supplier_article_code text, mill_name text, display_mill_name boolean NOT NULL DEFAULT false, collection_name text, season_code text, colour_name text, colour_family_code text, primary_hex text CHECK (primary_hex ~ '^#[0-9a-fA-F]{6}$'), secondary_hex text CHECK (secondary_hex ~ '^#[0-9a-fA-F]{6}$'), pattern_code text, weave_code text, texture_code text, sheen_code text, finish_codes text[] NOT NULL DEFAULT '{}', composition jsonb NOT NULL DEFAULT '[]'::jsonb, weight_gsm integer CHECK (weight_gsm BETWEEN 60 AND 700), super_number integer CHECK (super_number BETWEEN 60 AND 250 AND super_number % 10 = 0), yarn_count text, width_cm integer CHECK (width_cm BETWEEN 100 AND 180), stretch_code text, season_codes text[] NOT NULL DEFAULT '{}', climate_codes text[] NOT NULL DEFAULT '{}', occasion_codes text[] NOT NULL DEFAULT '{}', formality integer CHECK (formality BETWEEN 1 AND 5), wrinkle_resistance text CHECK (wrinkle_resistance IN ('low','medium','high')), breathability text CHECK (breathability IN ('low','medium','high')), opacity text CHECK (opacity IN ('low','medium','high')), drape text CHECK (drape IN ('fluid','balanced','structured')), care_codes text[] NOT NULL DEFAULT '{}', description_short text NOT NULL DEFAULT '' CHECK (char_length(description_short) <= 160), story text NOT NULL DEFAULT '' CHECK (char_length(story) <= 2000), tag_codes text[] NOT NULL DEFAULT '{}', usages text[] NOT NULL DEFAULT '{}' CHECK (usages <@ ARRAY['shell','lining','contrast','shirting']::text[]), price_band_code text REFERENCES price_bands(code), availability text NOT NULL DEFAULT 'unknown' CHECK (availability IN ('in_stock','low_stock','out_of_stock','discontinued','unknown')), stock_meters numeric(10,2) CHECK (stock_meters >= 0), lead_time_days integer CHECK (lead_time_days BETWEEN 0 AND 365), availability_updated_at timestamptz, texture_scale_cm numeric(6,2) CHECK (texture_scale_cm > 0), metadata jsonb NOT NULL DEFAULT '{}'::jsonb, reference_only boolean NOT NULL DEFAULT false, first_published_version integer, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS products (id text PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, short_label text NOT NULL, description text NOT NULL DEFAULT '', measurement_set text NOT NULL CHECK (measurement_set IN ('suit','shirt','blazer')), visual_model text NOT NULL CHECK (visual_model IN ('suit','shirt','blazer')), default_material_id text REFERENCES materials(id), hero_media_id text REFERENCES media_assets(id), fabric_consumption_cm integer CHECK (fabric_consumption_cm BETWEEN 50 AND 1000), sort integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')), reference_only boolean NOT NULL DEFAULT false, first_published_version integer, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS material_products (material_id text NOT NULL REFERENCES materials(id) ON DELETE CASCADE, product_id text NOT NULL REFERENCES products(id), PRIMARY KEY (material_id, product_id));
CREATE TABLE IF NOT EXISTS material_media (material_id text NOT NULL REFERENCES materials(id) ON DELETE CASCADE, media_id text NOT NULL REFERENCES media_assets(id), role text NOT NULL CHECK (role IN ('swatch','texture','closeup','drape','garment')), sort integer NOT NULL DEFAULT 0, PRIMARY KEY (material_id, media_id));
CREATE TABLE IF NOT EXISTS material_price_overrides (material_id text NOT NULL REFERENCES materials(id) ON DELETE CASCADE, product_id text NOT NULL REFERENCES products(id), price_minor integer NOT NULL CHECK (price_minor >= 0), row_version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (material_id, product_id));
CREATE TABLE IF NOT EXISTS product_band_prices (product_id text NOT NULL REFERENCES products(id), band_code text NOT NULL REFERENCES price_bands(code), price_minor integer NOT NULL CHECK (price_minor >= 0), row_version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (product_id, band_code));
CREATE TABLE IF NOT EXISTS components (id text PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', visual_part text NOT NULL CHECK (visual_part IN ('jacket','trousers','vest','shirt')), sort integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')), reference_only boolean NOT NULL DEFAULT false, first_published_version integer, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS product_components (product_id text NOT NULL REFERENCES products(id), component_id text NOT NULL REFERENCES components(id), required boolean NOT NULL DEFAULT true, default_included boolean NOT NULL DEFAULT true, surcharge_minor integer NOT NULL DEFAULT 0 CHECK (surcharge_minor >= 0), include_label text, sort integer NOT NULL DEFAULT 0, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (product_id, component_id), CHECK (NOT required OR default_included));
CREATE TABLE IF NOT EXISTS option_groups (id text PRIMARY KEY, code text NOT NULL UNIQUE, component_id text NOT NULL REFERENCES components(id), name text NOT NULL, short_name text NOT NULL, description text NOT NULL DEFAULT '', kind text NOT NULL CHECK (kind IN ('style','accent')), line_kind text NOT NULL DEFAULT 'construction' CHECK (line_kind IN ('construction','accessory')), icon_media_id text REFERENCES media_assets(id), focus_region text, surcharge_minor integer NOT NULL DEFAULT 0 CHECK (surcharge_minor >= 0), visible_when jsonb, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, sort integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')), reference_only boolean NOT NULL DEFAULT false, first_published_version integer, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS option_groups_component_idx ON option_groups(component_id, sort);
CREATE TABLE IF NOT EXISTS attributes (id text PRIMARY KEY, code text NOT NULL UNIQUE, group_id text NOT NULL REFERENCES option_groups(id), name text NOT NULL, help_text text NOT NULL DEFAULT '', input_type text NOT NULL CHECK (input_type IN ('choice','text')), required boolean NOT NULL DEFAULT true, text_rules jsonb, visual_slot text, metadata_fields jsonb NOT NULL DEFAULT '[]'::jsonb, surcharge_minor integer NOT NULL DEFAULT 0 CHECK (surcharge_minor >= 0), visible_when jsonb, legacy_key text, sort integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')), reference_only boolean NOT NULL DEFAULT false, first_published_version integer, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS attributes_group_idx ON attributes(group_id, sort);
CREATE TABLE IF NOT EXISTS option_values (id text PRIMARY KEY, attribute_id text NOT NULL REFERENCES attributes(id), code text NOT NULL, label text NOT NULL, description text NOT NULL DEFAULT '', image_media_id text REFERENCES media_assets(id), is_default boolean NOT NULL DEFAULT false, is_off boolean NOT NULL DEFAULT false, surcharge_minor integer NOT NULL DEFAULT 0 CHECK (surcharge_minor >= 0), supplier_code text, visual_token text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, sort integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')), reference_only boolean NOT NULL DEFAULT false, first_published_version integer, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (attribute_id, code));
CREATE UNIQUE INDEX IF NOT EXISTS option_values_one_default ON option_values(attribute_id) WHERE is_default AND status <> 'archived';
CREATE TABLE IF NOT EXISTS product_option_settings (id text PRIMARY KEY, product_id text NOT NULL REFERENCES products(id), scope text NOT NULL CHECK (scope IN ('group','attribute','value')), group_id text REFERENCES option_groups(id), attribute_id text REFERENCES attributes(id), value_id text REFERENCES option_values(id), available boolean NOT NULL DEFAULT true, default_value_id text REFERENCES option_values(id), surcharge_override_minor integer CHECK (surcharge_override_minor >= 0), row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK ((scope = 'group' AND group_id IS NOT NULL AND attribute_id IS NULL AND value_id IS NULL) OR (scope = 'attribute' AND attribute_id IS NOT NULL AND group_id IS NULL AND value_id IS NULL) OR (scope = 'value' AND value_id IS NOT NULL AND group_id IS NULL AND attribute_id IS NULL)), CHECK (default_value_id IS NULL OR scope = 'attribute'));
CREATE UNIQUE INDEX IF NOT EXISTS product_option_settings_target ON product_option_settings(product_id, scope, (coalesce(group_id, attribute_id, value_id)));
CREATE TABLE IF NOT EXISTS compatibility_rules (id text PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, product_ids text[] NOT NULL DEFAULT '{}', when_condition jsonb NOT NULL, effect text NOT NULL CHECK (effect IN ('forbid','require')), attribute_id text NOT NULL REFERENCES attributes(id), value_ids text[] NOT NULL, customer_message text NOT NULL, sort integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')), first_published_version integer, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS templates (id text PRIMARY KEY, code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), product_id text NOT NULL REFERENCES products(id), material_id text NOT NULL REFERENCES materials(id), name text NOT NULL, subtitle text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', story text NOT NULL DEFAULT '' CHECK (char_length(story) <= 2000), included_components text[] NOT NULL DEFAULT '{}', selections jsonb NOT NULL DEFAULT '{}'::jsonb, occasion_codes text[] NOT NULL DEFAULT '{}', climate_codes text[] NOT NULL DEFAULT '{}', featured boolean NOT NULL DEFAULT false, sort integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')), reference_only boolean NOT NULL DEFAULT false, first_published_version integer, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS template_media (template_id text NOT NULL REFERENCES templates(id) ON DELETE CASCADE, media_id text NOT NULL REFERENCES media_assets(id), role text NOT NULL CHECK (role IN ('hero','gallery')), sort integer NOT NULL DEFAULT 0, PRIMARY KEY (template_id, media_id));
CREATE TABLE IF NOT EXISTS catalog_releases (version integer PRIMARY KEY CHECK (version > 0), id text NOT NULL UNIQUE, snapshot jsonb NOT NULL, checksum text NOT NULL, reference_only boolean NOT NULL, notes text NOT NULL DEFAULT '', validation jsonb NOT NULL DEFAULT '{}'::jsonb, restored_from_version integer, published_by text NOT NULL, published_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS commerce_settings (id text PRIMARY KEY CHECK (id = 'default'), currency text NOT NULL DEFAULT 'USD', shipping_flat_minor integer NOT NULL DEFAULT 0 CHECK (shipping_flat_minor >= 0), ship_countries text[] NOT NULL DEFAULT '{US}', quote_ttl_minutes integer NOT NULL DEFAULT 10080 CHECK (quote_ttl_minutes BETWEEN 60 AND 43200), order_number_prefix text NOT NULL DEFAULT 'VS' CHECK (order_number_prefix ~ '^[A-Z]{2,4}$'), ops_timezone text NOT NULL DEFAULT 'UTC', row_version integer NOT NULL DEFAULT 1, updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO commerce_settings(id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
```

Notes:

- `commerce_settings` defaults (`USD`, `{US}`, 7-day quote TTL) are **development placeholders** pending Q-019. The settings screen shows them as unconfirmed until an owner saves them.
- Lookup codes on materials and templates have no foreign keys (the target is `(type_code, code)`). They are validated by services and by publish (`lookup_unknown`).
- System lookup types and values are seeded by `scripts/catalog-bootstrap.ts` (idempotent upserts by code), not by SQL.

### 4.2 `0004_staff.sql` (TASK-018)

The column and table names match Better Auth 1.7.6 `twoFactor` plugin fields (`node_modules/better-auth/dist/plugins/two-factor/schema.mjs`: `twoFactorEnabled`, `secret`, `backupCodes`, `userId`, `verified`, `failedVerificationCount`, `lockedUntil`). The Drizzle keys are camelCase and are exported as `twoFactor`.

```sql
CREATE TABLE IF NOT EXISTS staff_roles (user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, role text NOT NULL CHECK (role IN ('owner','catalog_manager','order_manager','tailor','support')), granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, role));
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
CREATE TABLE IF NOT EXISTS two_factor (id text PRIMARY KEY, secret text NOT NULL, backup_codes text NOT NULL, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, verified boolean DEFAULT true, failed_verification_count integer DEFAULT 0, locked_until timestamp);
CREATE INDEX IF NOT EXISTS two_factor_secret_idx ON two_factor(secret);
CREATE INDEX IF NOT EXISTS two_factor_user_idx ON two_factor(user_id);
```

### 4.3 `0005_orders.sql` (TASK-023)

```sql
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;
CREATE TABLE IF NOT EXISTS quotes (id text PRIMARY KEY, owner text NOT NULL, draft_id text NOT NULL, draft_revision integer NOT NULL, catalog_version integer NOT NULL REFERENCES catalog_releases(version), currency text NOT NULL, lines jsonb NOT NULL, subtotal_minor integer NOT NULL CHECK (subtotal_minor >= 0), shipping_minor integer NOT NULL CHECK (shipping_minor >= 0), total_minor integer NOT NULL CHECK (total_minor >= 0), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY, number text NOT NULL UNIQUE, owner text NOT NULL, user_id text NOT NULL REFERENCES "user"(id), draft_id text NOT NULL, draft_revision integer NOT NULL, current_snapshot_version integer NOT NULL DEFAULT 1, quote_id text NOT NULL REFERENCES quotes(id), catalog_version integer NOT NULL, currency text NOT NULL, subtotal_minor integer NOT NULL, shipping_minor integer NOT NULL, total_minor integer NOT NULL, signed_off_at timestamptz NOT NULL, signoff_statement_version text NOT NULL, tailor_review_requested boolean NOT NULL DEFAULT false, tailor_review_status text NOT NULL DEFAULT 'not_requested' CHECK (tailor_review_status IN ('not_requested','awaiting_payment','pending','in_review','awaiting_customer','completed','cancelled')), payment_status text NOT NULL DEFAULT 'checkout_ready' CHECK (payment_status IN ('not_started','checkout_ready','payment_pending','succeeded','failed','cancelled','refund_pending','refunded')), fulfillment_status text NOT NULL DEFAULT 'not_released' CHECK (fulfillment_status IN ('not_released','released','in_production','quality_check','ready_to_ship','shipped','delivered','completed','on_hold','cancelled')), needs_attention boolean NOT NULL DEFAULT false, shipping_address jsonb, customer_eta_date date, submit_action_id text NOT NULL UNIQUE, submit_fingerprint text NOT NULL, submitted_at timestamptz NOT NULL DEFAULT now(), row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(tailor_review_status, payment_status, fulfillment_status);
CREATE TABLE IF NOT EXISTS order_snapshots (order_id text NOT NULL REFERENCES orders(id), version integer NOT NULL, kind text NOT NULL CHECK (kind IN ('submitted','amendment')), snapshot jsonb NOT NULL, checksum text NOT NULL, quote_id text NOT NULL REFERENCES quotes(id), action_id text NOT NULL UNIQUE, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (order_id, version));
CREATE TABLE IF NOT EXISTS order_items (id text PRIMARY KEY, order_id text NOT NULL REFERENCES orders(id), snapshot_version integer NOT NULL, line_no integer NOT NULL CHECK (line_no > 0), product_code text NOT NULL, template_code text, quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 5), unit_price_minor integer NOT NULL CHECK (unit_price_minor >= 0), line_total_minor integer NOT NULL CHECK (line_total_minor >= 0), spec jsonb NOT NULL, supplier_id text REFERENCES suppliers(id), supplier_reference text, supplier_due_date date, fulfillment_status text NOT NULL DEFAULT 'not_released' CHECK (fulfillment_status IN ('not_released','released','in_production','quality_check','ready_to_ship','shipped','delivered','completed','on_hold','cancelled')), hold_resume_status text, tracking jsonb, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (order_id, snapshot_version, line_no));
CREATE INDEX IF NOT EXISTS order_items_supplier_idx ON order_items(supplier_id, supplier_due_date);
CREATE TABLE IF NOT EXISTS review_cases (id text PRIMARY KEY, order_id text NOT NULL REFERENCES orders(id), snapshot_version integer NOT NULL, status text NOT NULL CHECK (status IN ('awaiting_payment','pending','in_review','awaiting_customer','completed','cancelled')), due_at timestamptz, assigned_to text, decision text CHECK (decision IN ('no_changes','changes_proposed')), proposed_measurements jsonb, customer_message text, decision_notes text, decided_by text, decided_at timestamptz, customer_response text CHECK (customer_response IN ('accepted_changes','kept_original')), customer_responded_at timestamptz, amendment_snapshot_version integer, measurements_verified_by text, measurements_verified_at timestamptz, overdue_notified_at timestamptz, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS review_cases_one_open ON review_cases(order_id) WHERE status NOT IN ('completed','cancelled');
CREATE INDEX IF NOT EXISTS review_cases_queue_idx ON review_cases(status, due_at);
CREATE INDEX IF NOT EXISTS review_cases_order_idx ON review_cases(order_id, snapshot_version);
CREATE TABLE IF NOT EXISTS order_events (id text PRIMARY KEY, order_id text NOT NULL REFERENCES orders(id), order_item_id text REFERENCES order_items(id), type text NOT NULL, from_value text, to_value text, reason text, data jsonb NOT NULL DEFAULT '{}'::jsonb, actor text NOT NULL, visible_to_customer boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id, created_at);
CREATE TABLE IF NOT EXISTS notifications (id text PRIMARY KEY, order_id text REFERENCES orders(id), recipient_user_id text NOT NULL REFERENCES "user"(id), purpose text NOT NULL, dedupe_key text NOT NULL UNIQUE, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')), attempts integer NOT NULL DEFAULT 0, last_error_code text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz);
CREATE INDEX IF NOT EXISTS notifications_pending_idx ON notifications(status, created_at);
```

`review_cases` holds optional **post-payment tailor reviews** only (D-020, ORDERS-FULFILLMENT §4). The automated check lives in the draft and the order snapshot. `order_events.type` values: `order_submitted` (includes the sign-off), `order_resubmitted`, `order_cancelled`, `tailor_review_opened`, `tailor_review_claimed`, `tailor_review_decided`, `tailor_review_customer_responded`, `tailor_review_overdue`, `order_amended`, `payment_started`, `payment_succeeded`, `payment_failed`, `payment_cancelled`, `payment_refunded`, `payment_anomaly`, `supplier_assigned`, `deadline_changed`, `status_changed`, `tracking_added`, `eta_changed`, `note`, `notification_failed`. `dedupe_key` = `${purpose}:${orderId}:${snapshotVersion|paymentId|eventId}`.

### 4.4 `0006_payments.sql` (TASK-024)

```sql
CREATE TABLE IF NOT EXISTS payments (id text PRIMARY KEY, order_id text NOT NULL REFERENCES orders(id), provider text NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe','fake')), provider_session_id text UNIQUE, provider_payment_intent_id text UNIQUE, snapshot_version integer NOT NULL, quote_id text NOT NULL REFERENCES quotes(id), amount_minor integer NOT NULL CHECK (amount_minor > 0), shipping_minor integer NOT NULL CHECK (shipping_minor >= 0), currency text NOT NULL, status text NOT NULL CHECK (status IN ('payment_pending','succeeded','failed','cancelled','refund_pending','refunded')), livemode boolean NOT NULL, checkout_action_id text NOT NULL UNIQUE, row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending ON payments(order_id) WHERE status = 'payment_pending';
```

The existing `stripe_webhook_events` table is reused for deduplication (the event id is the primary key). The scan-service tables stay untouched (D-017).

## 5. Catalog snapshot contract

`src/modules/catalog/snapshot.ts` defines Zod schemas. The inferred types are:

```ts
type Minor = number; // integer >= 0
type Condition = /* CATALOG-ADMIN.md 5.1 */;
type CatalogSnapshot = {
  schemaVersion: 1;
  version: number; publishedAt: string; referenceOnly: boolean;
  currency: string;
  settings: { shippingFlatMinor: Minor; quoteTtlMinutes: number; orderNumberPrefix: string; shipCountries: string[] };
  lookups: Record<string, { code: string; label: string; description: string; sort: number; metadata: Record<string, unknown> }[]>;
  priceBands: { code: string; name: string; sort: number }[];
  media: Record<string, { id: string; url: string; contentType: string; width: number | null; height: number | null; alt: string; rightsStatus: string }>;
  components: {
    code: string; name: string; description: string; visualPart: 'jacket'|'trousers'|'vest'|'shirt'; sort: number; referenceOnly: boolean;
    groups: {
      code: string; name: string; shortName: string; description: string; kind: 'style'|'accent';
      lineKind: 'construction'|'accessory'; iconMediaId: string | null; focusRegion: string;
      surchargeMinor: Minor; visibleWhen: Condition | null; sort: number; referenceOnly: boolean;
      attributes: {
        code: string; name: string; helpText: string; inputType: 'choice'|'text'; required: boolean;
        textRules: { maxLength: number; pattern: string | null; transform: 'none'|'upper'; placeholder: string } | null;
        visualSlot: string | null; surchargeMinor: Minor; visibleWhen: Condition | null; sort: number;
        metadataFields: { key: string; label: string; type: 'lookup'|'text'|'number'|'boolean'; lookupType: string | null; required: boolean }[];
        defaultValueCode: string | null; referenceOnly: boolean;
        values: { code: string; label: string; description: string; imageMediaId: string | null; surchargeMinor: Minor;
                  supplierCode: string | null; visualToken: string | null; isOff: boolean; sort: number;
                  metadata: Record<string, string | number | boolean>; referenceOnly: boolean }[];
      }[];
    }[];
  }[];
  products: {
    code: string; name: string; shortLabel: string; description: string; sort: number; heroMediaId: string | null;
    measurementSet: 'suit'|'shirt'|'blazer'; visualModel: 'suit'|'shirt'|'blazer';
    defaultMaterialCode: string; referenceOnly: boolean;
    components: { componentCode: string; required: boolean; defaultIncluded: boolean; surchargeMinor: Minor; includeLabel: string | null; sort: number }[];
    bandPrices: Record<string, Minor>;
    settings: { groups: Record<string, { available: boolean; surchargeOverrideMinor: Minor | null }>;
                attributes: Record<string, { available: boolean; defaultValueCode: string | null; surchargeOverrideMinor: Minor | null }>;
                values: Record<string /* `${attributeCode}::${valueCode}` */, { available: boolean; surchargeOverrideMinor: Minor | null }> };
  }[];
  materials: {
    code: string; name: string; colourName: string | null; colourFamily: string | null; primaryHex: string; secondaryHex: string | null;
    pattern: string; renderPattern: 'plain'|'twill'|'check'|'stripe'; weave: string | null; texture: string | null; sheen: string | null;
    finishes: string[]; composition: { fibre: string; percent: number }[]; weightGsm: number | null; superNumber: number | null;
    yarnCount: string | null; widthCm: number | null; stretch: string | null; seasons: string[]; climates: string[]; occasions: string[];
    formality: number | null; wrinkleResistance: string | null; breathability: string | null; opacity: string | null; drape: string | null;
    care: string[]; descriptionShort: string; story: string; tags: string[]; usages: string[]; productCodes: string[];
    priceBand: string | null; priceOverrides: Record<string /* productCode */, Minor>;
    media: { mediaId: string; role: 'swatch'|'texture'|'closeup'|'drape'|'garment'; sort: number }[];
    textureScaleCm: number | null; referenceOnly: boolean;
    supplier: { id: string; name: string; articleCode: string | null } | null; millName: string | null; displayMillName: boolean;
    collection: string | null; seasonCode: string | null;
  }[];
  rules: { code: string; productCodes: string[]; when: Condition; effect: 'forbid'|'require'; attributeCode: string; valueCodes: string[]; message: string }[];
  templates: { code: string; productCode: string; name: string; subtitle: string; description: string; story: string;
               materialCode: string; includedComponents: string[]; selections: Record<string, string>;
               occasions: string[]; climates: string[]; featured: boolean; sort: number;
               heroMediaId: string | null; galleryMediaIds: string[]; asShownPriceMinor: Minor | null; referenceOnly: boolean }[];
};
```

- Only `active` rows are compiled. Arrays are sorted by `sort`, then `code`. `checksum = sha256(canonicalJson(snapshot without version/publishedAt))`, so “unpublished changes” = `checksum(compile(working)) !== current.checksum`.
- `CustomerCatalog` = `toCustomerCatalog(snapshot)` removes the fields listed in CATALOG-ADMIN §9. `materials[].supplier` becomes null, and `millName` stays only when `displayMillName` is set.
- Size budget: the imported suit catalog is about 300 KB as JSON. Releases above 5 MB are the publish error `release_too_large`.

## 6. Release store and caching

- `getCurrentVersion()`: `SELECT version FROM catalog_releases ORDER BY version DESC LIMIT 1` on each request that needs the catalog. It is one indexed row, which keeps multiple Autoscale instances consistent without a shared cache (ARCHITECTURE.md).
- `getRelease(version)`: an in-process LRU of 5 versions `{snapshot, customer, index}`, where `index` holds Maps by code for components, groups, attributes, values, materials, templates and products. The JSON is parsed and Zod-validated once per load.
- `getWorkingPreview()`: compiles the working copy. It is cached by the working checksum (LRU 2) and used only for staff preview.
- `getAvailability()`: `SELECT code, availability, lead_time_days FROM materials`, cached for 60 s per instance. Admin availability edits bust the local cache. Other instances converge within 60 s. Submission and checkout **always** read availability without the cache.
- Publish takes `pg_advisory_xact_lock(731851)` (the migration lock is 731850).
- Bootstrap: `ensureCatalog()` is called by the catalog-dependent repositories. If no release exists and `CATALOG_AUTO_BOOTSTRAP` is on (default outside production), it runs the importer and publishes v1 under the same lock. In production it throws `DomainError('catalog_unavailable', …, 503)`, and `/api/ready` reports `{status:'not_ready', reason:'catalog_missing'}`.

## 7. Draft v2 and lazy upgrade

### 7.1 Types (`src/modules/configuration/types.ts`)

```ts
type Garment = {
  id: string;                       // uuid; for upgraded v1 drafts = draft.id (deterministic)
  productCode: string; templateCode: string | null; catalogVersion: number;
  materialCode: string; includedComponents: string[];            // component codes, required ones included
  selections: Record<string, string>;                            // attribute code -> value code | text
  preferences: { occasion: string | null; climate: string | null };
  confirmed: ('product' | 'material' | 'preferences' | 'details')[];
  quantity: number;                                              // 1..5
};
type DraftV2 = {
  schemaVersion: 2; id: string; revision: number; createdAt: string; updatedAt: string;
  activeGarmentId: string | null; garments: Garment[];           // 0..10
  skinTone: 'porcelain' | 'warm' | 'tan' | 'deep';
  measurements: Measurements;                                    // unchanged shape
  messages: ChatMessage[];                                       // suggestion?: { garmentId: string | null; patch: GarmentPatch }
  review: OrderCheck | null;                                     // automated order check (ORDERS-FULFILLMENT 2.1)
  orders: { orderId: string; number: string; submittedAt: string }[];
};
const garmentPatch = z.object({
  productCode: codeSchema.optional(),
  materialCode: codeSchema.optional(),
  preferences: z.object({ occasion: codeSchema.nullable().optional(), climate: codeSchema.nullable().optional() }).strict().optional(),
  components: z.record(codeSchema, z.boolean()).refine((v) => Object.keys(v).length <= 10).optional(),
  selections: z.record(z.string().min(1).max(180), z.string().max(180)).refine((v) => Object.keys(v).length <= 100).optional(),
}).strict();
const commandSchemaV2 = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_garment'), productCode: codeSchema, templateCode: codeSchema.nullable().optional() }),
  z.object({ type: z.literal('remove_garment'), garmentId: z.uuid(), confirm: z.boolean().optional() }),
  z.object({ type: z.literal('select_garment'), garmentId: z.uuid() }),
  z.object({ type: z.literal('design'), garmentId: z.uuid().optional(), patch: garmentPatch,
             confirmCategoryChange: z.boolean().optional(), confirmImpact: z.boolean().optional() }),
  z.object({ type: z.literal('set_quantity'), garmentId: z.uuid(), quantity: z.number().int().min(1).max(5) }),
  z.object({ type: z.literal('accept_design'), garmentId: z.uuid().optional() }),
  z.object({ type: z.literal('rebase_catalog'), garmentId: z.uuid(), confirmImpact: z.boolean() }),
  z.object({ type: z.literal('appearance'), skinTone: z.enum(['porcelain', 'warm', 'tan', 'deep']) }),
  /* 'measurements' exactly as today. 'review' stays as today until TASK-023, which removes it from
     CommandV2 and replaces it with POST /api/studio/check (the AI advisory call must run outside the
     pure engine, like chat). */
]);
type OrderCheck = {
  id: string; inputRevision: number; policyVersion: 'check-policy-v1'; status: 'correction_required' | 'passed';
  findings: { id: string; severity: 'blocker' | 'advice'; source: 'rules' | 'ai'; target: 'design' | 'measurements' | 'commercial';
              garmentId?: string; title: string; description: string }[];
  aiAdvisory: 'completed' | 'unavailable' | 'not_configured'; createdAt: string;
};
```

Command semantics (engine v2). Commands without `garmentId` target `activeGarmentId`, and return 422 `garment_not_found` when there is none.

- `add_garment`: the product must be active in the current release (422 `product_unavailable`). A template must be active and for that product (422 `template_unavailable`). The garment is built from the template’s resolved configuration or the product defaults (`defaultsFor`). It becomes active. More than 10 garments returns 422 `garment_limit_reached`. Measurements become unconfirmed if the union of required fields grows (CRT-004).
- `design`: applies the patch through `applyGarmentPatch`. A product change with confirmed choices and no `confirmCategoryChange` returns 409 `category_confirmation_required` (today’s behaviour, kept). An unknown or unavailable code returns 422 `unavailable_option` with `details {attributeCode, valueCode}`. A material not allowed or not active returns 422 `incompatible_fabric`. A material out of stock returns 409 `material_unavailable`. A rule-driven change to other selections without `confirmImpact` returns 409 `impact_confirmation_required` with `details.impact`. A text value must pass `textRules` (422 `invalid_text` with `details.attributeCode`). The confirmed keys are updated as today (`material`, `preferences` when both are set, `product`). The command clears `review`.
- `accept_design`: requires both preferences, a valid material, every visible required attribute answered, and no rule violations (422 `design_incomplete` with `details.missing[]`). It sets all four confirmed keys and clears `review`.
- `rebase_catalog`: applies `rebaseGarment` to the current version. A non-empty impact list requires `confirmImpact: true`.
- `remove_garment`, `select_garment`, `set_quantity` and `appearance` behave as named. Removal follows CRT-003.
- Every garment-scoped command first auto-rebases when the garment’s version is stale and the impact list is empty. Otherwise it returns 409 `catalog_update_required` with `details.impact`.

`GET /api/studio` and `POST /api/studio` responses gain `{catalogVersion, catalogUpdates: {garmentId, impact[]}[], quote: CartQuote, availability: Record<materialCode, availability>}`. The client loads `CustomerCatalog` from `/api/catalog/v/{catalogVersion}`. Prices are never computed on the client.

`Impact = { garmentId: string; kind: 'selection_removed'|'selection_replaced'|'component_removed'|'material_unavailable'|'product_unavailable'; attributeCode?: string; from?: string; to?: string; message: string }`.

### 7.2 v1 → v2 upgrade (`upgrade.ts`, pure and deterministic)

It is applied to every Draft read from `drafts.data`, `actions.result` and `revisions.data` (the v1 shape has no `schemaVersion`). The upgraded form is persisted naturally by the next successful command.

| v1 | v2 |
| --- | --- |
| `design.product` | `garments[0].productCode`; `garments[0].id = draft.id`; `activeGarmentId = draft.id`; `templateCode = null`; `catalogVersion = 1`; `quantity = 1` |
| `design.fabricId` | `materialCode` (same code) |
| suit `customizations` | `selections` = customizations without `style.vest.waistcoat.waistcoat`. `includedComponents` = `['jacket','trousers']`, plus `'vest'` when that key equals `'1'`. `style.jacket.jacket_fit.jacket-fit`: keep it if present, otherwise map `design.fit`: Tailored→`1`, Classic→`0`, Relaxed→`relaxed` |
| blazer | `includedComponents ['jacket']`. Selections: jacket-fit from `fit` (as above); `…jacket-lapel-type` Notch→`standard`, Peak→`peak`; `…jacket-pockets-type` Flap→`2`, Patch→`2b`; `…jacket-style-combined` One button→`simple_1`, Two buttons→`simple_2` |
| shirt | `includedComponents ['shirt']`. `style.shirt.shirt_fit.shirt-fit` Tailored→`tailored`, Classic→`classic`, Relaxed→`relaxed`; `…shirt-collar` Spread→`spread`, Point→`point`; `…shirt-cuffs` Button→`button`, French→`french` |
| `occasion`, `climate` labels | `preferences` codes: Office→`office`, Wedding→`wedding`, Formal event→`formal_event`, Everyday→`everyday`; Warm→`warm`, All season→`all_season`, Cool→`cool`; `''`→`null` |
| `confirmed` | If it includes `details`, all four keys. Otherwise `product`→`product`, `fabricId`→`material`, and `preferences` when both `occasion` and `climate` are present |
| `skinTone` | `draft.skinTone` |
| `messages[].suggestion` (DesignPatch) | `{garmentId: draft.id, patch}`, converted by the same mapping. It is dropped when not convertible |
| — | `orders: []`, `schemaVersion: 2` |

A v1 draft whose codes are not in the current release is left as is, and the first read reports `catalogUpdates` (§7.1). New drafts start with `garments: []`, and the customer lands on the start screen (S-01).

## 8. Order snapshot contract

`OrderSnapshotV1` (Zod, `src/modules/orders/submission.ts`) follows ORDERS-FULFILLMENT §3:

```ts
type OrderSnapshotV1 = {
  schemaVersion: 1; orderId: string; number: string; version: number; submittedAt: string;
  kind: 'submitted' | 'amendment';
  currency: string; catalogVersion: number; catalogReferenceOnly: boolean; renderer: string; tailorReviewRequested: boolean;
  check: { id: string; policyVersion: string; ranAt: string; aiAdvisory: string; findings: OrderCheck['findings'] };
  signoff: { userId: string; at: string; statementVersion: string; design: true; measurements: true; draftRevision: number; measurementVersion: number };
  amendment: { reason: 'tailor_review'; reviewCaseId: string; previousVersion: number;
               changedMeasurements: { id: string; label: string; fromMm: number; toMm: number }[]; acceptedAt: string } | null;
  customer: { userId: string; name: string; email: string };
  items: {
    lineNo: number; quantity: number; product: { code: string; name: string }; template: { code: string; name: string } | null;
    material: { code: string; name: string; colourName: string | null; supplier: { id: string; name: string } | null;
                supplierArticleCode: string | null; composition: { fibre: string; percent: number }[]; weightGsm: number | null;
                pattern: string; weave: string | null };
    components: { code: string; name: string; included: boolean }[];
    options: { groupCode: string; groupName: string; attributeCode: string; attributeName: string; valueCode: string | null;
               valueLabel: string | null; text: string | null; supplierCode: string | null; lineKind: 'construction'|'accessory';
               surchargeMinor: number }[];
    preferences: { occasion: string | null; climate: string | null };
    quote: { lines: QuoteLine[]; unitMinor: number; totalMinor: number };
  }[];
  measurements: { version: number; source: 'customer'|'3dlook'; confirmed: boolean; updatedAt: string | null;
                  values: { id: string; label: string; mm: number }[] };
  totals: { subtotalMinor: number; shippingMinor: number; totalMinor: number; quoteId: string; expiresAt: string };
};
```

`checksum = sha256(canonicalJson(snapshot))`. `order_items.spec` = `items[lineNo-1]` + `{number, version}`, **without measurements**. Measurements are read from the snapshot at `orders.current_snapshot_version`, so an accepted tailor amendment updates them without touching item rows (ORDERS-FULFILLMENT §3–4). The production sheet and customer spec view render only from these stored JSON documents, never from live catalog rows.

## 9. Storage adapter (CAT-016)

```ts
interface StorageProvider {
  driver: 'local' | 'object_store' | 'static';
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}
```

- `local`: files under `STORAGE_LOCAL_DIR` (default `.data/media`). Like PGlite, it is **rejected in production**, because the Replit filesystem is not durable (ARCHITECTURE.md).
- `static`: read-only access to imported `/public/reference-assets/**`. `GET /api/media/{id}` answers 308 to the static path.
- `object_store`: the production driver, TASK-026, gated by Q-024 (new dependency approval).
- The upload pipeline (`POST /api/admin/media`): stream `multipart/form-data` with a 5 MiB cap (413 `upload_too_large`); check magic bytes (JPEG `FF D8 FF`; PNG `89 50 4E 47 0D 0A 1A 0A`; WebP `RIFF????WEBP`), and reject SVG and all other types (415 `upload_invalid`); read the width and height from the PNG IHDR, JPEG SOF0/SOF2 or WebP VP8/VP8L/VP8X header (dimensions 64–8000 px); compute sha256 and return the existing media row for a duplicate; store the key `media/<uuid>.<ext>`. The alt text and rights status are required form fields. The EXIF metadata limitation is recorded in Q-024, with no image-processing dependency added.
- Serving (`GET /api/media/{id}`): stream the bytes with the stored content type, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'`. Replacing an image creates a new media id. Catalog media must never contain customer data, and customer uploads (appearance photos) never use this store.

## 10. Payment provider adapter (PAY-007 to PAY-009)

```ts
interface PaymentProvider {
  name: 'stripe' | 'fake';
  createCheckout(input: { paymentId: string; orderId: string; number: string; snapshotVersion: number; currency: string;
    items: { name: string; description: string; unitMinor: number; quantity: number }[]; shippingMinor: number;
    shipCountries: string[]; customerEmail: string; successUrl: string; cancelUrl: string }):
    Promise<{ sessionId: string; url: string; livemode: boolean }>;
  retrieveCheckout(sessionId: string): Promise<{ status: 'open'|'complete'|'expired'; paymentStatus: 'paid'|'unpaid'|'no_payment_required';
    amountTotalMinor: number; currency: string; paymentIntentId: string | null; shipping: unknown | null; metadata: Record<string, string> }>;
  expireCheckout(sessionId: string): Promise<void>;
  parseWebhook(rawBody: string, signature: string): NormalizedPaymentEvent;   // throws on a bad signature
}
type NormalizedPaymentEvent = { id: string; type: 'session_completed'|'async_succeeded'|'async_failed'|'session_expired'|'refunded'|'ignored';
  livemode: boolean; sessionId: string | null; paymentIntentId: string | null; paymentStatus: string | null;
  amountTotalMinor: number | null; currency: string | null; metadata: Record<string, string>; shipping: unknown | null };
```

- `stripe-orders.ts` uses the existing `getStripe()`. It never returns Stripe objects beyond this normalised shape (AGENTS.md: provider payloads stay out of the domain).
- `fake.ts` is selected only when `PAYMENT_PROVIDER=fake` **and** `NODE_ENV === 'test'`. It throws at import time in production (AGENTS.md: demo providers must not be enabled accidentally). E2E tests use it to reach `succeeded` through a signed synthetic event path, and unit tests sign Stripe-shaped payloads with `stripe.webhooks.generateTestHeaderString`.

## 11. Assistant grounding (AI-001 to AI-005)

- The developer context sent to OpenAI contains: the active garment summary (product, material code and name, preferences, visible attribute codes with current value codes); the allowed materials for the product (at most 60, ordered by preference match; `code, name, colourFamily, pattern, composition summary, climates, occasions, formality`); visible choice attributes (at most 80, each with at most 25 values of `code, label`); the lookups `occasion` and `climate`; and the quote status and total from the server. It never contains supplier fields, stock, measurements or other garments’ data.
- The response schema changes to `changes: {kind: 'product'|'material'|'preference'|'component'|'selection', key: string, value: string}[]`. The server converts it to a `GarmentPatch` and **dry-runs** it through `applyGarmentPatch` on the current release. Invalid changes are dropped: the message is kept and the suggestion omitted. An incompatible suggestion is never thrown to the customer as an error (AC-05).
- Guided mode maps keywords to lookups (colour-family labels, pattern labels, climate and occasion labels) instead of hard-coded fabric ids.
- Applying a suggestion when the cart is empty sends `add_garment` (from `patch.productCode`) followed by `design`.
- **Order-check advisory** (`adviseOrderCheck(draft, snapshot)`, TASK-023, D-020): a separate Responses call with its own versioned prompt and a schema of at most 5 advice items. Its input is limited to the ORDERS-FULFILLMENT §2.1 scope (no measurement values, pending Q-032). It has a 20 s timeout, no retries, and `store: false`. Its output can only add `advice` findings. It is never called from the pure engine.

## 12. Environment variables (additions to `.env.example`)

| Variable | Default | Rule |
| --- | --- | --- |
| `STAFF_MFA_REQUIRED` | `false` (development) | Ignored in production (always required) |
| `CATALOG_AUTO_BOOTSTRAP` | `true` outside production | Ignored in production (explicit `npm run catalog:bootstrap`) |
| `STORAGE_DRIVER` | `local` | `local` is rejected in production. `object_store` requires TASK-026 |
| `STORAGE_LOCAL_DIR` | `.data/media` | — |
| `STRIPE_ORDER_WEBHOOK_SECRET` | empty | Separate from the scan-service `STRIPE_WEBHOOK_SECRET` |
| `PAYMENTS_LIVE_ENABLED` | `false` | Production and live keys only after Q-019 approval |
| `PAYMENT_PROVIDER` | `stripe` | `fake` only when `NODE_ENV=test` |

## 13. Test strategy and evidence

| Level | Scope (minimum) |
| --- | --- |
| Unit (Vitest, pure) | conditions (every operator, depth and cycle limits); structure and effective selections; validateGarment and applyGarmentPatch impacts; the validation catalogue (one fixture per error and warning code); PRICING E1–E7; money parsing; importer determinism (twice → equal checksum), 434 values imported and every visual binding resolved; v1→v2 upgrade table; fulfilment transition table (every allowed and one denied transition per state), including the tailor-review release guard; check-policy-v1 blocking and advice findings (AI output can never block or clear); the tailor-review state table and amendment construction; the permission matrix |
| Repository (Vitest + PGlite temp dir, like `tests/repository.test.ts`) | migrations re-run idempotently; row_version conflict; publish concurrency (two publishes → one wins); restore round-trip; the draft rebase flow; submission idempotency, the concurrent double submit and the `acceptTotal` mismatch; resubmission versions; webhook deduplication, mismatch and out-of-order; supplier assignment and deadline history; audit rows written in the same transaction |
| Route handlers | Each `/api/admin/**` endpoint called with a non-staff session (403), a staff session without the permission (403), and without MFA when required (403 `mfa_required`); plus `checkOrigin` rejections |
| Visual non-regression (AC-43) | Golden `sketchSpec()` outputs and 3D choice sets recorded **before** the TASK-016 refactor for a synthetic matrix (every value of every bound attribute over the defaults, for suit, shirt and blazer) and compared after |
| Playwright | Admin: create a fabric → publish → the customer sees it. Template → customise → price breakdown. Two-garment cart. Check → sign off (with tailor review) → place order → pay with the fake provider → tailor proposes a measurement change → customer accepts (amendment) → order manager assigns a supplier and deadline and releases → shipped → customer tracking. A second order without tailor review can be released straight after payment. Keyboard-only pass on ADM-02, ADM-05 and ADM-12; axe checks; viewports 1440, 768 and 390 (order desk) |

Fixtures are synthetic and labelled `SYNTHETIC` (AGENTS.md). Stripe is exercised only in test mode or with the fake provider. No real customer, supplier or payment data is used in tests or evidence.
