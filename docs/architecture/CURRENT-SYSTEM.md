# Current system (as built, 2026-09-28)

Status: descriptive baseline at commit `4d20445`, updated for TASK-015 (M1) and TASK-016 (M2, 2026-09-28). It describes what the code does today, not the target. It is the starting point for D-019 and TASK-015 to TASK-026. When code and this file disagree, the code is authoritative; fix this file in the same change.

## Stack

| Concern | Implementation | Pinned version |
| --- | --- | --- |
| Web framework | Next.js App Router, Node runtime, `src/app` | next 16.3.6 (read `node_modules/next/dist/docs/` before writing Next code; Middleware is now `proxy.ts`; route `params` is a `Promise`) |
| Language | TypeScript strict | 6.0.3 (do not upgrade, see ADR-010) |
| UI | React 19.3, Tailwind 4, Radix Dialog/Tabs/Slot, lucide-react, local `src/components/ui/*` | see `package.json` |
| Validation | Zod 4 (`z.uuid()`, `.toJSONSchema()`) | 4.6.5 |
| Database | PostgreSQL through `pg` Pool when `DATABASE_URL` is set; otherwise PGlite in `.data/postgres` (development and tests only) | pg 8.23, pglite 0.5.8 |
| Data access | Raw SQL through `getDatabase().query/transaction` (`src/db/client.ts`); Drizzle schema used by the Better Auth adapter | drizzle-orm 0.45.3 |
| Auth | Better Auth email/password with verification, reset, database sessions and database rate limits | better-auth 1.7.6 |
| AI | OpenAI Responses adapter (`src/integrations/assistant.ts`); guided regex mode without keys | openai 7.23 |
| 3D | three / R3F / drei, CC0 MakeHuman body, generated garments | three 0.186 |
| Payments | `stripe` SDK present; only an inert scan-service ledger uses it | stripe 22.6.2 |
| Tests | Vitest (`tests/*.test.ts`), Playwright (`tests/e2e`) | vitest 5, playwright 1.63 |

## Customer journey today

1. `/` renders `Studio` (`src/components/studio.tsx`). `GET /api/studio` creates a draft lazily with **no garments**, and the client loads the customer catalog of the current release from `/api/catalog/v/{version}`. An empty cart shows **Choose a garment** (`start-screen.tsx`): the customer picks a product and starts designing (`add_garment`).
2. **Step 1 · Design.** The left pane toggles between *Ask your tailor* (chat, `design-consultation.tsx`) and *Choose details* (`design-navigator.tsx`). Both send the same `design` command for the active garment. The right pane shows a 2D SVG technical drawing (`garment-sketch.tsx`) or 3D (`garment-view.tsx`), both drawn from render values (`visualization/binding.ts`). Selection tags (`selection-tags.tsx`) show choices grouped by customer tab. Rule-driven changes to other choices open an impact dialog; a catalog change that affects a garment shows a banner and a review dialog.
3. **Step 2 · Measurements.** Manual entry in mm internally, with cm/in display (`measurement-panel.tsx`, `modules/measurements/definitions.ts`), over the union of the fields the cart's garments need. The customer can also *Measure with 3DLOOK* (SAIA widget, sign-in required, D-017/D-018).
4. **Step 3 · Review.** `review-panel.tsx` runs the `review` command. The deterministic findings (`modules/review/review.ts`) always include the blocker `quote-unavailable` until TASK-017, so `checkoutEligible` is always `false`. `POST /api/checkout` always fails, with 409 `review_required` or 503 `checkout_unavailable`.

There is one active draft per owner (`drafts.owner` is unique). The draft engine holds up to 10 garments; the studio shows the active one (the cart UI is TASK-022). There are no templates, prices, orders, suppliers or staff roles yet.

## Identity and ownership (`src/lib/http.ts`)

- `identity(request)` reads the `vessy-guest` cookie. The cookie holds a random 43-character base64url token; the owner is `guest:<sha256(token)>`. If a Better Auth session exists, the owner is `user:<userId>` and `claimGuest` moves a guest draft to the user when the user has none.
- `requireSignedIn(who)` returns 401 `sign_in_required` for guests.
- `checkOrigin(request)` requires `Origin` to equal `APP_URL` (or the request origin) on every mutating route. Otherwise it returns 403 `invalid_origin`.
- `body(request)` streams JSON with a hard 20,000-byte cap and returns 413 `body_too_large` or 400 `invalid_json`.
- `failure(e)` returns `{error:{code,message}}`: the status from `DomainError`, 422 `invalid_input` for a `ZodError`, and 503 `temporarily_unavailable` otherwise. Every JSON response has `Cache-Control: no-store`.
- `enforceLimit(key, max, seconds)` is a fixed-window limiter stored in the `request_limits` table (429 `rate_limited`).

## Draft aggregate and commands

`DraftV2` (`src/modules/configuration/types.ts`, ADMIN-BACKEND §7.1) is stored as JSONB in `drafts.data`. A v1 draft (no `schemaVersion`) is upgraded on every read path by `configuration/upgrade.ts` (§7.2) and persisted as v2 by the next command:

```ts
DraftV2 = { schemaVersion: 2, id, revision, activeGarmentId, garments: Garment[], skinTone, measurements, messages, review, orders, createdAt, updatedAt }
Garment = { id, productCode, templateCode, catalogVersion, materialCode, includedComponents, selections, preferences: {occasion, climate}, confirmed, quantity }
```

Commands go through `POST /api/studio` with `{ actionId: uuid, expectedRevision: int, command }` (`commandSchemaV2`): `add_garment`, `remove_garment`, `select_garment`, `design` (a `GarmentPatch` through `catalog/garment.ts#applyGarmentPatch`, with `confirmCategoryChange` and `confirmImpact`), `set_quantity`, `accept_design`, `rebase_catalog`, `appearance`, `measurements` and `review`. The pure engine (`configuration/engine.ts`) receives the current release, the releases garments are pinned to and the live availability from the repository. Error codes follow API-REFERENCE §1.1 (`unavailable_option`, `incompatible_fabric`, `material_unavailable`, `invalid_text`, `impact_confirmation_required`, `catalog_update_required`, `category_confirmation_required`, `design_incomplete`, `garment_not_found`, `garment_limit_reached`, `garment_removal_confirmation_required`, `cart_empty`, `unknown_measurement`, `missing_measurements`).

`src/db/repository.ts#save` loads the engine context before the transaction (PGlite serialises queries behind an open one), then runs one transaction: it locks the row with `SELECT … FOR UPDATE`, replays `actions` by `actionId` and a sha256 `fingerprint` (409 `action_conflict` if the payload differs), checks `expectedRevision` (409 `revision_conflict`), writes the prior JSON to `revisions`, updates `drafts`, and inserts the receipt into `actions`.

## Catalog today (database releases; code sources kept for the importer)

The customer runtime reads the **published catalog release**: the working tables of `migrations/0003_catalog.sql`, loaded by the importer (`modules/catalog/import-legacy.ts`) and published as immutable `catalog_releases` (`db/release-repository.ts`; `npm run catalog:bootstrap`, or automatically outside production). The server indexes a release (`indexSnapshot`); the browser indexes its customer projection (`indexCatalog`); the same pure modules run on both: `catalog/structure.ts` (customer tabs, effective selections), `catalog/garment.ts` (patch, validation, rebase), `configuration/design-outline.ts` (navigator, tags and focus) and `visualization/binding.ts`. Live fabric availability is overlaid from `materials` (`db/availability.ts`, 60-second cache).

| Code source (import only) | Content |
| --- | --- |
| `modules/catalog/catalog.ts` | `PRODUCTS`, the 8 reference `FABRICS`, `OCCASIONS`, `CLIMATES`, `FITS` and `DETAIL_OPTIONS`, read by the importer and the v1 upgrade mapping |
| `modules/catalog/suit-customization.seed.json` (generated by `scripts/build-suit-customization-seed.mjs`, TASK-012) | Suit only. `menus[style, accents] → categories[jacket, pants, vest] → groups (44) → sections (66) → options (434)`, imported as release groups, options and choices |

## Visual binding (CATALOG-ADMIN §6)

The renderers read render values, never catalog selection keys: `binding.ts#renderValues(index, garment, skinTone)` maps each visible option bound to a registry slot (`visualization/registry.ts`) to its choice's visual token and image, plus the included parts. `sketch-spec.ts` turns them into drawing parameters for 2D and 3D; `focus-regions.ts` reads each group's `focus_region`; `garments/coverage.ts` derives “shown in 3D” from the slots. A visible choice without a token is flagged “Not illustrated”. The WP-00b goldens (`tests/golden/*.json`) are unchanged on this path.

## Database tables today

Migrations `0001_foundation.sql`, `0002_saia_measurement_scan.sql` and `0003_catalog.sql` (listed in `src/db/client.ts#MIGRATIONS`):

`user`, `session`, `account`, `verification`, `rate_limit` (Better Auth) · `drafts`, `actions`, `revisions`, `request_limits` · `saia_measurement_drafts`, `measurement_source_snapshots` · `scan_service_payments`, `scan_entitlements`, `garment_credits`, `stripe_webhook_events`, `scan_attempt_events` (inert paid-scan ledger, D-017) · catalog (0003): `audit_events`, `lookup_types`, `lookup_values`, `suppliers`, `supplier_contacts`, `media_assets`, `price_bands`, `materials`, `material_products`, `material_media`, `material_price_overrides`, `products`, `product_band_prices`, `components`, `product_components`, `option_groups`, `attributes`, `option_values`, `product_option_settings`, `compatibility_rules`, `templates`, `template_media`, `catalog_releases`, `commerce_settings` (one `default` row of Q-019 placeholders). All tables are mirrored in `src/db/schema.ts`; `tests/migrations.test.ts` checks the mirror.

Migration mechanics that constrain new work:

- PGlite (development and tests) runs **every** migration file on **every** process start (`connect()`). Every statement must be idempotent (`CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
- `scripts/migrate.ts` (hosted PostgreSQL) splits files on `;`. A statement must not contain a semicolon inside a string, function body or `DO` block. Do not use PL/pgSQL functions, triggers or `DO $$` blocks.
- Add each new file name to `MIGRATIONS` in `src/db/client.ts`, and update `src/db/schema.ts` (Drizzle) in the same change (ADR-010).

## Existing HTTP API

All handlers are thin and delegate to `src/db` and `src/modules`. Bodies are JSON. Errors use `{error:{code,message}}`.

| Method and path | Auth | Request | Response and notes |
| --- | --- | --- | --- |
| `GET /api/health` | none | — | `{status:'ok', version}` |
| `GET /api/ready` | none | — | `{status:'ready'}`, or 503 `{status:'not_ready'}` (database) or `{status:'not_ready', reason:'catalog_missing'}` (no catalog release; outside production the check bootstraps v1 first) |
| `GET /api/auth-config` | none | — | `{enabled, localEmail}` |
| `GET\|POST /api/auth/[...all]` | Better Auth | Better Auth contract | Sign-up/in/out, verify, reset, session |
| `GET /api/studio` | guest or user | — | `{draft, catalogVersion, catalogUpdates, quote, availability, user, assistantMode:'ai'\|'guided'}`; sets the guest cookie |
| `POST /api/studio` | guest or user + origin | `{actionId, expectedRevision, command}` | The same envelope without `user`; limit 80/min per owner |
| `POST /api/chat` | guest or user + origin | `{actionId, expectedRevision, message (1–1500)}` | The same envelope; the assistant message may carry `suggestion: {garmentId, patch}`, dry-run on the current release (the customer applies it with `design`); limits 12/min per owner and 80/min globally |
| `GET /api/catalog/current` | none | — | `{version}`, `no-store` |
| `GET /api/catalog/v/[version]` | none | — | The customer projection of the release, cached `public, max-age=31536000, immutable`; 404 if unknown |
| `GET /api/media/[id]` | none | — | 308 to the static path for imported media; other drivers from TASK-019 |
| `POST /api/checkout` | guest or user + origin | — | Always 409 `review_required` or 503 `checkout_unavailable` (`integrations/checkout.ts`) |
| `POST /api/measurements/saia/session` | signed in + origin | `{targetUnit:'cm'\|'in', mode?:'public'\|'paid'}` | 201 `{draft}` (SAIA capture draft); `paid` returns 503 until vendor authorisation exists |
| `PUT /api/measurements/saia/[captureToken]` | signed in + origin | `{person}` (widget result) | `{draft}` with mapped mm values and raw dimensions snapshot |
| `GET /api/measurements/saia/latest` | signed in | — | `{draft}` latest capture draft |
| `GET /api/scan-service/policy` | none | — | Fee and terms (inert) |
| `POST /api/scan-service/checkout` | signed in + origin | — | Always 503 (D-017) |
| `POST /api/scan-service/webhook` | Stripe signature | raw body | Scan-service events only; dedupe in `stripe_webhook_events` |

## Known gaps D-019 closes

No database catalog, no admin, no roles or MFA, no prices, no templates, no multi-garment cart, no orders or order snapshots, no staff review queue, no garment payment, no suppliers or fulfilment tracking, no object storage, no audit log. The target design is in the files listed in D-019. Everything above stays working until the task that replaces it says otherwise.
