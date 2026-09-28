# HTTP API reference

Status: proposed v0.3 under D-019 (2026-09-28). This is the complete endpoint contract for the customer app, the admin panel and webhooks: existing endpoints (see [CURRENT-SYSTEM.md](CURRENT-SYSTEM.md)), changed endpoints, and the new endpoints of TASK-015 to TASK-027. Data meaning is in the domain files. Tables, DTO sources and guards are in [ADMIN-BACKEND.md](ADMIN-BACKEND.md). It implements the DATA-API.md “schema and contract delivery gate”: typed schemas, paths and methods, the authorisation matrix, and error semantics. Each task adds contract tests for its endpoints.

## 1. Conventions

- **Transport**: JSON over HTTPS. Admin routes live under `/api/admin/**`. Every route file exports `runtime = 'nodejs'`. Dynamic `params` are awaited (`{ params }: { params: Promise<{…}> }`, Next 16).
- **Auth levels**:
  - `public`: no session.
  - `owner`: a guest or signed-in owner from `identity()`.
  - `signed-in`: `requireSignedIn`.
  - `staff:<permission>`: `requireStaff(request, permission)` ([ADMIN-BACKEND.md §3](ADMIN-BACKEND.md#3-staff-identity-and-authorisation-adm-001-adm-002-auth-004-sec-001-ux-012-ac-18-ac-31)).
  - `stripe`: signature-verified webhook.
- **Mutations** (`POST|PUT|PATCH|DELETE`) outside webhooks call `checkOrigin` (403 `invalid_origin`).
- **Money**: integers in minor units (`…Minor`) with the envelope `currency`. There are no decimals in the API (PRICING.md PRC-001).
- **Concurrency**: admin updates carry `rowVersion`. On a mismatch the response is 409 `stale_row_version` with `details.current`.
- **Idempotency**: customer commands and order actions carry `actionId` (uuid). The same id with the same payload returns the original result. The same id with a different payload returns 409 `action_conflict`.
- **Pagination**: `?limit=` (1–100, default 50) and `&cursor=` (opaque) → `{ items: T[], nextCursor: string | null }`.
- **Errors**: `{ error: { code, message, details? } }` with `Cache-Control: no-store`.
- **Codes**: see [ADMIN-BACKEND.md §2](ADMIN-BACKEND.md#2-conventions) for the formats.

### 1.1 Error code registry

| Code | HTTP | Meaning |
| --- | --- | --- |
| `invalid_origin` | 403 | Mutation without a same-origin `Origin` |
| `invalid_json`, `body_too_large` | 400, 413 | Body parsing (existing) |
| `invalid_input` | 422 | Customer route schema failure (generic message, existing) |
| `validation_failed` | 422 | Admin schema or business validation; `details.fields[] {path, message}` |
| `sign_in_required` | 401 | No session |
| `forbidden` | 403 | Not staff, or missing the permission |
| `mfa_required` | 403 | Staff without enrolled MFA where required |
| `last_owner` | 409 | Revoking the last owner |
| `not_found`, `order_not_found`, `garment_not_found` | 404 | Missing, or not owned (no enumeration) |
| `rate_limited` | 429 | Existing limiter |
| `revision_conflict`, `action_conflict` | 409 | Existing draft concurrency and idempotency |
| `stale_row_version` | 409 | Admin optimistic concurrency |
| `code_taken`, `code_immutable` | 409 | Unique code clash; code change after first publish |
| `entity_published`, `entity_in_use` | 409 | Hard delete of a published or referenced entity (archive instead) |
| `publish_blocked` | 422 | Validation errors; `details.report` |
| `nothing_to_publish` | 422 | The working checksum equals the current release checksum |
| `warnings_unacknowledged` | 409 | Publish without a matching `warningsChecksum` |
| `stale_release` | 409 | `expectedCurrentVersion` is not current |
| `release_too_large` | 422 | Snapshot over 5 MB |
| `catalog_unavailable` | 503 | No release (production, not bootstrapped) |
| `category_confirmation_required` | 409 | Product change needs confirmation (existing) |
| `impact_confirmation_required` | 409 | A change removes or replaces selections; `details.impact[]` |
| `catalog_update_required` | 409 | The garment must be rebased with impact; `details.impact[]` |
| `unavailable_option`, `invalid_text` | 422 | Choice unknown or unavailable; text rule failure; `details.attributeCode` |
| `incompatible_fabric` | 422 | Material not allowed or active for the product (existing code) |
| `material_unavailable` | 409 | Live availability is out of stock or discontinued |
| `product_unavailable`, `template_unavailable` | 422 | Not active in the current release |
| `garment_limit_reached` | 422 | More than 10 garments |
| `garment_removal_confirmation_required` | 409 | CRT-003 |
| `design_incomplete`, `missing_measurements`, `measurements_unconfirmed`, `cart_empty` | 422 | Submission gates; `details.garmentId` / `details.missing[]` |
| `quote_unavailable` | 409 | A garment is unpriced |
| `quote_changed` | 409 | `acceptTotal` differs; `details.quote` |
| `quote_expired` | 409 | Checkout after the quote TTL |
| `catalog_not_orderable` | 409 | Reference-only data in production |
| `order_state_invalid` | 409 | Action not allowed in the current payment, tailor-review or fulfilment state |
| `check_required` | 409 | Submission without a passed automated check of the current draft revision (D-020) |
| `signoff_required` | 422 | Missing or outdated design or measurement sign-off (REV-009) |
| `payment_pending` | 409 | A pending payment is still being reconciled |
| `payments_disabled` | 503 | PAY-007 guard |
| `supplier_inactive` | 409 | Assignment to an inactive supplier |
| `transition_not_allowed` | 409 | FUL-003 table; `details.allowed[]` |
| `primary_contact_required` | 409 | An active supplier without a primary contact |
| `currency_locked` | 409 | Currency change after the first order |
| `upload_invalid`, `upload_too_large` | 415, 413 | Media validation |
| `endpoint_removed` | 410 | Replaced endpoint (`POST /api/checkout`) |
| `temporarily_unavailable` | 503 | Unexpected error (existing) |

## 2. Public and customer endpoints

### 2.1 Unchanged

`GET /api/health`, `GET /api/auth-config`, `/api/auth/[...all]` (plus Better Auth `twoFactor` routes after TASK-018), `/api/measurements/saia/*`, `/api/scan-service/*`: as in CURRENT-SYSTEM.md.

### 2.2 Changed

| Endpoint | Auth | Change |
| --- | --- | --- |
| `GET /api/ready` | public | Also checks that a catalog release exists: `{status:'not_ready', reason:'catalog_missing'}` 503 |
| `GET /api/studio` | owner | Response `{draft: DraftV2, user, assistantMode, catalogVersion, catalogUpdates, quote: CartQuote, availability}` (ADMIN-BACKEND §7). `?catalog=working` → staff preview (`staff:catalog.read`, owner `preview:user:<id>`, response adds `isPreview: true`) |
| `POST /api/studio` | owner | Body `{actionId, expectedRevision, command: CommandV2}`. Response `{draft, catalogVersion, catalogUpdates, quote, availability}` |
| `POST /api/chat` | owner | Same envelope. The stored assistant message `suggestion` becomes `{garmentId, patch: GarmentPatch}` |
| `POST /api/studio/check` (new, TASK-023) | owner + origin | `{actionId, expectedRevision}` → `{draft}` with `draft.review: OrderCheck` (ORDERS-FULFILLMENT §2.1). It replaces the `review` command. Idempotent by `actionId`. Limit 12/min per owner. The AI advisory is skipped, and recorded as `unavailable`, when the global assistant limit is reached |
| `POST /api/checkout` | owner | **Removed in TASK-024** → 410 `endpoint_removed` (replaced by §2.5) |

### 2.3 Catalog (new, TASK-016)

| Endpoint | Auth | Response |
| --- | --- | --- |
| `GET /api/catalog/current` | public | `{version}`, `no-store` |
| `GET /api/catalog/v/{version}` | public | `CustomerCatalog` (the projection of the release). `Cache-Control: public, max-age=31536000, immutable`. 404 if unknown |
| `GET /api/media/{id}` | public | Image bytes (ADMIN-BACKEND §9), or 308 to the static path |

### 2.4 Orders (new, TASK-023)

```ts
type SubmitOrderInput = { actionId: string; expectedRevision: number; checkId: string;
                          signoff: { design: true; measurements: true; statementVersion: 'signoff-v1' };
                          tailorReview: boolean;
                          acceptTotal: { amountMinor: number; currency: string } };
type OrderCustomerDTO = {
  number: string; submittedAt: string; signedOffAt: string; currency: string; totalMinor: number; subtotalMinor: number; shippingMinor: number;
  check: { aiAdvisory: string; advice: { title: string; description: string }[] };
  tailorReview: { requested: boolean; status: string; dueAt: string | null; overdue: boolean; customerMessage: string | null;
                  proposedChanges: { id: string; label: string; currentMm: number; proposedMm: number }[];
                  response: 'accepted_changes' | 'kept_original' | null; verified: boolean };
  payment: { status: string };
  fulfillment: { status: string; label: string; etaDate: string | null };
  items: { lineNo: number; productName: string; templateName: string | null; materialName: string; quantity: number;
           lineTotalMinor: number; options: { group: string; option: string; choice: string }[];
           status: string; statusLabel: string; tracking: { carrier?: string; trackingNumber?: string; trackingUrl?: string; method?: string } | null }[];
  measurements: { version: number; source: string; values: { label: string; mm: number }[] };
  timeline: { at: string; label: string }[];                    // visible_to_customer events only
  actions: ('pay' | 'respond_tailor' | 'resubmit' | 'cancel')[];
  snapshotVersion: number;
};
```

| Endpoint | Auth | Request | Response and errors |
| --- | --- | --- | --- |
| `POST /api/orders` | signed-in + origin | `SubmitOrderInput` | 201 `{order: OrderCustomerDTO}` with `payment.status='checkout_ready'`; the UI then calls checkout (§2.5). A replay returns 200 with the same order. Errors are the ORDERS-FULFILLMENT §2.2 table. Limit 10/min |
| `GET /api/orders` | signed-in | `?cursor&limit` | `{items: Pick<OrderCustomerDTO,'number'\|'submittedAt'\|'totalMinor'\|'currency'\|'tailorReview'\|'payment'\|'fulfillment'>[], nextCursor}` |
| `GET /api/orders/{number}` | signed-in (owner) | — | `{order: OrderCustomerDTO}`; 404 `order_not_found` for non-owners |
| `POST /api/orders/{number}/resubmit` | signed-in + origin | `SubmitOrderInput` (the current draft, with a new check and sign-off) | `{order}`; 409 `order_state_invalid` after a successful or pending payment (ORD-009) |
| `POST /api/orders/{number}/cancel` | signed-in + origin | `{actionId, reason?: string(≤500)}` | `{order}`; 409 `order_state_invalid` after a successful payment (ORD-010) |
| `POST /api/orders/{number}/tailor-review/respond` | signed-in + origin | `{actionId, response: 'accept_changes' \| 'keep_original'}` | `{order}` (an accepted change creates an amendment snapshot, ORDERS-FULFILLMENT §4); 409 `order_state_invalid` unless the review is `awaiting_customer` |

### 2.5 Payment (new, TASK-024)

| Endpoint | Auth | Request | Response and errors |
| --- | --- | --- | --- |
| `POST /api/orders/{number}/checkout` | signed-in + origin | `{actionId}` | `{checkoutUrl}`; no review approval is required (D-020). Errors `quote_expired`, `material_unavailable`, `payment_pending`, `payments_disabled`, `order_state_invalid` (PAY-008). Limit 10/min |
| `POST /api/payments/stripe/webhook` | stripe (`STRIPE_ORDER_WEBHOOK_SECRET`) | raw body | 200 `{received:true}` (also for ignored or duplicate events and recorded anomalies); 400 for a bad signature or livemode mismatch; 503 when not configured (PAY-009) |

## 3. Admin endpoints

All are `staff:<permission>`. Mutations also require the origin check and write `audit_events`. DTOs use camelCase mirrors of the table columns (ADMIN-BACKEND §4), plus the computed fields noted. Every catalog DTO includes `id`, `code`, `status`, `rowVersion`, `firstPublishedVersion`, `referenceOnly`, `createdAt`, `updatedAt` and `badges: {errors: string[], warnings: string[]}` (validation codes affecting the entity).

### 3.1 Staff, audit and settings (TASK-018)

| Endpoint | Permission | Request | Response |
| --- | --- | --- | --- |
| `GET /api/admin/me` | any staff (MFA not required) | — | `{user:{id,name,email}, roles[], permissions[], mfa:{required, enabled}}` |
| `GET /api/admin/staff` | `staff.manage` | — | `{items:[{userId, name, email, roles[], mfaEnabled, grantedAt}]}` |
| `POST /api/admin/staff/grants` | `staff.manage` | `{email, role}` | 201 `{userId, role}`. Already granted → 200. 404 `not_found` (unknown or unverified user; generic message) |
| `POST /api/admin/staff/revocations` | `staff.manage` | `{userId, role}` | `{ok:true}`; 409 `last_owner` |
| `GET /api/admin/audit` | `audit.read` | `?entityType&entityId&actor&from&to&cursor` | Paged `{id, actor, action, entityType, entityId, summary, createdAt}` |
| `GET /api/admin/settings/commerce` | `catalog.read` | — | `{currency, shippingFlatMinor, shipCountries[], quoteTtlMinutes, orderNumberPrefix, opsTimezone, rowVersion, confirmed: boolean}` |
| `PATCH /api/admin/settings/commerce` | `settings.write` | a partial of the above + `rowVersion` | Updated DTO; 409 `currency_locked`; 422 for an invalid currency, country (ISO alpha-2) or IANA timezone |

### 3.2 Lookups and media (TASK-019)

| Endpoint | Permission | Request | Response |
| --- | --- | --- | --- |
| `GET /api/admin/lookups` | `catalog.read` | — | `{types:[{code, label, system, valueMetadataSchema, values:[LookupValueDTO]}]}` (inactive included) |
| `POST /api/admin/lookups/{typeCode}/values` | `catalog.write` | `{code, label, description?, metadata?}` | 201 `LookupValueDTO`; 409 `code_taken` |
| `PATCH /api/admin/lookup-values/{id}` | `catalog.write` | `{rowVersion, label?, description?, metadata?, active?}` | DTO; `code` is not patchable |
| `POST /api/admin/lookups/{typeCode}/order` | `catalog.write` | `{orderedIds: string[]}` | `{ok:true}` |
| `POST /api/admin/media` | `catalog.write` | `multipart/form-data`: `file`, `altText` (1–250), `rightsStatus`, `sourceNote?` | 201 `MediaDTO {id, url, contentType, bytes, width, height, altText, rightsStatus, sourceNote}`; 413/415 |
| `GET /api/admin/media` | `catalog.read` | `?query&rightsStatus&cursor` | Paged `MediaDTO` with a `usedBy` count |
| `PATCH /api/admin/media/{id}` | `catalog.write` | `{rowVersion, altText?, rightsStatus?, sourceNote?}` | `MediaDTO` |

### 3.3 Suppliers (TASK-020)

```ts
type ContactInput = { name: string; roleTitle?: string; email?: string; phone?: string; preferredChannel?: 'email'|'phone'; notes?: string };
type SupplierInput = { code: string; name: string; legalName?: string; kind: 'fabric_mill'|'fabric_merchant'|'manufacturer'|'accessory'|'other';
  status?: 'active'|'inactive'; website?: string; addressLine1?: string; addressLine2?: string; city?: string; region?: string;
  postalCode?: string; countryCode?: string; defaultLeadTimeDays?: number; capabilities?: string[]; notes?: string;
  primaryContact?: ContactInput; secondaryContact?: ContactInput };
```

| Endpoint | Permission | Request | Response |
| --- | --- | --- | --- |
| `GET /api/admin/suppliers` | `suppliers.read` | `?query&kind&status&cursor` | Paged `{id, code, name, kind, status, city, countryCode, primaryContactName, openItems, overdueItems}` |
| `POST /api/admin/suppliers` | `suppliers.write` | `SupplierInput` (an active supplier requires address line 1, city, country and a primary contact) | 201 `SupplierDTO` |
| `GET /api/admin/suppliers/{id}` | `suppliers.read` | — | `SupplierDTO` + `contacts {primary, secondary}` + `materials[{id, code, name, status}]` |
| `PATCH /api/admin/suppliers/{id}` | `suppliers.write` | `Partial<SupplierInput> + rowVersion` (`code` is immutable once referenced) | `SupplierDTO` |
| `PUT /api/admin/suppliers/{id}/contacts/{rank}` | `suppliers.write` | `ContactInput + rowVersion?` | `ContactDTO` |
| `DELETE /api/admin/suppliers/{id}/contacts/secondary` | `suppliers.write` | — | `{ok:true}` (the primary cannot be deleted while the supplier is active: 409 `primary_contact_required`) |
| `GET /api/admin/suppliers/{id}/items` | `suppliers.read` + `orders.read` | `?status&overdue&cursor` | Paged `{orderId, number, itemId, lineNo, productName, status, dueDate, overdue}` |

### 3.4 Catalog structure and rules (TASK-019)

```ts
type ProductInput = { code: string; name: string; shortLabel: string; description?: string; measurementSet: 'suit'|'shirt'|'blazer';
  visualModel: 'suit'|'shirt'|'blazer'; defaultMaterialId?: string | null; heroMediaId?: string | null; fabricConsumptionCm?: number | null;
  sort?: number; status?: 'draft'|'active'|'archived' };
type ComponentInput = { code: string; name: string; description?: string; visualPart: 'jacket'|'trousers'|'vest'|'shirt'; sort?: number; status?: string };
type LinkInput = { required: boolean; defaultIncluded: boolean; surchargeMinor: number; includeLabel?: string | null; sort?: number };
type GroupInput = { code: string; name: string; shortName: string; description?: string; kind: 'style'|'accent';
  lineKind?: 'construction'|'accessory'; iconMediaId?: string | null; focusRegion: string; surchargeMinor?: number;
  visibleWhen?: Condition | null; sort?: number; status?: string };
type AttributeInput = { code: string; name: string; helpText?: string; inputType: 'choice'|'text'; required?: boolean;
  textRules?: { maxLength: number; pattern?: string | null; transform?: 'none'|'upper'; placeholder?: string } | null;
  visualSlot?: string | null; metadataFields?: MetadataField[]; surchargeMinor?: number; visibleWhen?: Condition | null; sort?: number; status?: string };
type ValueInput = { code?: string /* generated from label when omitted */; label: string; description?: string; imageMediaId?: string | null;
  isDefault?: boolean; isOff?: boolean; surchargeMinor?: number; supplierCode?: string | null; visualToken?: string | null;
  metadata?: Record<string, string | number | boolean>; sort?: number; status?: string };
type SettingInput = { scope: 'group'|'attribute'|'value'; targetId: string; available: boolean;
  defaultValueId?: string | null; surchargeOverrideMinor?: number | null } | { scope: 'group'|'attribute'|'value'; targetId: string; remove: true };
type RuleInput = { code: string; name: string; productIds?: string[]; when: Condition; effect: 'forbid'|'require';
  attributeId: string; valueIds: string[]; customerMessage: string; sort?: number; status?: string };
```

| Endpoint | Permission | Request | Response |
| --- | --- | --- | --- |
| `GET /api/admin/catalog/products` | `catalog.read` | — | `{items:[ProductDTO + {componentCount, templateCount, priced: boolean}]}` |
| `POST /api/admin/catalog/products` | `catalog.write` | `ProductInput` | 201 `ProductDTO` |
| `PATCH /api/admin/catalog/products/{id}` | `catalog.write` | `Partial<ProductInput> + rowVersion` | `ProductDTO` |
| `GET /api/admin/catalog/products/{id}/tree` | `catalog.read` | — | `{product, links:[LinkDTO + {component: ComponentDTO + {groups:[GroupDTO + {attributes:[AttributeDTO + {values:[ValueDTO]}]}]}}], settings:[SettingDTO], effective: {groups/attributes/values: {available, default, surchargeMinor}}}`. The tree shows the product’s view with effective values, which the editor needs |
| `PUT /api/admin/catalog/products/{id}/components/{componentId}` | `catalog.write` | `LinkInput + rowVersion?` | `LinkDTO` |
| `DELETE /api/admin/catalog/products/{id}/components/{componentId}` | `catalog.write` | — | `{ok:true}` |
| `PUT /api/admin/catalog/products/{id}/settings` | `catalog.write` | `{items: SettingInput[]}` (≤500) | `{items: SettingDTO[]}` |
| `GET /api/admin/catalog/components` | `catalog.read` | — | `{items: ComponentDTO[]}` |
| `POST /api/admin/catalog/components` | `catalog.write` | `ComponentInput` | 201 |
| `PATCH /api/admin/catalog/components/{id}` | `catalog.write` | `Partial + rowVersion` | DTO |
| `POST /api/admin/catalog/components/{id}/groups` | `catalog.write` | `GroupInput` | 201 `GroupDTO` |
| `PATCH /api/admin/catalog/groups/{id}` | `catalog.write` | `Partial<GroupInput> + rowVersion` | DTO |
| `POST /api/admin/catalog/groups/{id}/duplicate` | `catalog.write` | `{newCode, newName}` | 201 (deep copy of attributes and values as `draft`, with new codes `<newCode>.<suffix>`) |
| `POST /api/admin/catalog/groups/{id}/attributes` | `catalog.write` | `AttributeInput` | 201 `AttributeDTO` |
| `PATCH /api/admin/catalog/attributes/{id}` | `catalog.write` | `Partial<AttributeInput> + rowVersion` | DTO |
| `POST /api/admin/catalog/attributes/{id}/values` | `catalog.write` | `ValueInput` | 201 `ValueDTO`. Setting `isDefault` clears the previous default in the same transaction |
| `PATCH /api/admin/catalog/values/{id}` | `catalog.write` | `Partial<ValueInput> + rowVersion` | DTO |
| `POST /api/admin/catalog/values/bulk` | `catalog.write` | `{items:[{id, rowVersion, surchargeMinor?, status?, sort?}]}` (≤500) | `{items: ValueDTO[]}`; all or nothing |
| `POST /api/admin/catalog/reorder` | `catalog.write` | `{entity:'link'\|'group'\|'attribute'\|'value', parentId, orderedIds[]}` | `{ok:true}` (writes `sort = index × 10`) |
| `DELETE /api/admin/catalog/{entity}/{id}` | `catalog.write` | `entity` ∈ `products`, `components`, `groups`, `attributes`, `values`, `materials`, `templates`, `rules` | `{ok:true}`; 409 `entity_published` or `entity_in_use` |
| `GET /api/admin/catalog/rules` | `catalog.read` | `?productId&attributeId` | `{items: RuleDTO[]}` |
| `POST /api/admin/catalog/rules` | `catalog.write` | `RuleInput` | 201 |
| `PATCH /api/admin/catalog/rules/{id}` | `catalog.write` | `Partial<RuleInput> + rowVersion` | DTO |
| `POST /api/admin/catalog/rules/evaluate` | `catalog.read` | `{source:'working'\|'current', productCode, materialCode?, includedComponents?, selections}` | `{visible:{groups[], attributes[]}, violations:[{ruleCode, attributeCode, message}], impactPreview[]}` |

### 3.5 Materials and pricing (TASK-020)

```ts
type MaterialInput = { code: string; name: string; status?: string; supplierId?: string | null; supplierArticleCode?: string | null;
  millName?: string | null; displayMillName?: boolean; collectionName?: string | null; seasonCode?: string | null;
  colourName?: string | null; colourFamilyCode?: string | null; primaryHex?: string | null; secondaryHex?: string | null;
  patternCode?: string | null; weaveCode?: string | null; textureCode?: string | null; sheenCode?: string | null; finishCodes?: string[];
  composition?: { fibre: string; percent: number }[]; weightGsm?: number | null; superNumber?: number | null; yarnCount?: string | null;
  widthCm?: number | null; stretchCode?: string | null; seasonCodes?: string[]; climateCodes?: string[]; occasionCodes?: string[];
  formality?: number | null; wrinkleResistance?: 'low'|'medium'|'high' | null; breathability?: 'low'|'medium'|'high' | null;
  opacity?: 'low'|'medium'|'high' | null; drape?: 'fluid'|'balanced'|'structured' | null; careCodes?: string[];
  descriptionShort?: string; story?: string; tagCodes?: string[]; usages?: ('shell'|'lining'|'contrast'|'shirting')[];
  productIds?: string[]; priceBandCode?: string | null; textureScaleCm?: number | null };
```

| Endpoint | Permission | Request | Response |
| --- | --- | --- | --- |
| `GET /api/admin/catalog/materials` | `catalog.read` | `?query&status&usage&productId&band&availability&supplierId&referenceOnly&cursor` | Paged `{id, code, name, status, swatchUrl, colourFamilyCode, patternCode, priceBandCode, availability, supplierName, productCodes[], badges}` |
| `POST /api/admin/catalog/materials` | `catalog.write` | `MaterialInput` | 201 `MaterialDTO` (all fields + `media[]`, `priceOverrides[]`, `supplier {id, name}`); lookup codes validated (422 `validation_failed`) |
| `GET /api/admin/catalog/materials/{id}` | `catalog.read` | — | `MaterialDTO` |
| `PATCH /api/admin/catalog/materials/{id}` | `catalog.write` | `Partial<MaterialInput> + rowVersion` | DTO |
| `PATCH /api/admin/catalog/materials/{id}/availability` | `catalog.write` | `{rowVersion, availability, stockMeters?, leadTimeDays?}` | DTO. **Live without publishing** (CATALOG-ADMIN §7.6); `availability_updated_at = now()` |
| `PUT /api/admin/catalog/materials/{id}/media` | `catalog.write` | `{items:[{mediaId, role, sort}]}` | `{items}` |
| `PUT /api/admin/catalog/materials/{id}/price-overrides` | `catalog.write` | `{items:[{productId, priceMinor: number \| null}]}` (null removes) | `{items}` |
| `POST /api/admin/catalog/materials/bulk` | `catalog.write` | `{ids[], set:{status?, priceBandCode?, availability?}}` (≤500) | `{updated: number}` |
| `POST /api/admin/catalog/materials/{id}/duplicate` | `catalog.write` | `{newCode, newName}` | 201 (as `draft`) |
| `POST /api/admin/catalog/{entity}/{id}/clear-reference-only` | `catalog.publish` | `{confirmation: "I confirm the supplier facts and image rights for this item were verified."}` (exact) | DTO; audit `reference_only.cleared`. `entity` ∈ `products`, `components`, `groups`, `attributes`, `values`, `materials`, `templates` |
| `GET /api/admin/pricing` | `catalog.read` | — | `{currency, bands:[{code, name, description, sort, materialCount}], matrix:[{productId, productCode, prices: Record<bandCode, number \| null>}]}` |
| `PUT /api/admin/pricing/bands` | `catalog.write` | `{items:[{code, name, description?, sort?}]}` | `{items}`; removing a band in use → 409 `entity_in_use` |
| `PUT /api/admin/pricing/products/{productId}/band-prices` | `catalog.write` | `{items:[{bandCode, priceMinor: number \| null}]}` | `{items}` |
| `POST /api/admin/pricing/simulate` | `catalog.read` | `{source:'working'\|'current', productCode, materialCode, includedComponents?, selections?, quantity?}` | `{quote: GarmentQuote, violations[]}`, from the same `quoteGarment` as customers (PRC-004) |

### 3.6 Templates (TASK-021)

```ts
type TemplateInput = { code: string; productId: string; materialId: string; name: string; subtitle?: string; description?: string;
  story?: string; includedComponents?: string[]; selections?: Record<string, string>; occasionCodes?: string[];
  climateCodes?: string[]; featured?: boolean; sort?: number; status?: string };
```

| Endpoint | Permission | Request | Response |
| --- | --- | --- | --- |
| `GET /api/admin/catalog/templates` | `catalog.read` | `?productId&status` | `{items:[TemplateDTO + {heroUrl, workingPriceMinor \| null, badges}]}` |
| `POST /api/admin/catalog/templates` | `catalog.write` | `TemplateInput` | 201 `TemplateDTO` |
| `GET /api/admin/catalog/templates/{id}` | `catalog.read` | — | `TemplateDTO` + `resolved` (defaults filled) + `quote` (working) + `violations[]` |
| `PATCH /api/admin/catalog/templates/{id}` | `catalog.write` | `Partial<TemplateInput> + rowVersion` | DTO |
| `PUT /api/admin/catalog/templates/{id}/media` | `catalog.write` | `{items:[{mediaId, role:'hero'\|'gallery', sort}]}` (exactly 1 hero, ≤8 gallery) | `{items}` |
| `POST /api/admin/catalog/templates/{id}/duplicate` | `catalog.write` | `{newCode, newName}` | 201 |
| `POST /api/admin/catalog/templates/from-preview` | `catalog.write` | `{garmentId, code, name}` (a garment in the caller’s preview draft) | 201 `TemplateDTO` (`draft`) |

### 3.7 Publishing (TASK-021)

| Endpoint | Permission | Request | Response |
| --- | --- | --- | --- |
| `GET /api/admin/catalog/status` | `catalog.read` | — | `{currentVersion \| null, currentChecksum, workingChecksum, unpublished: boolean, errors: number, warnings: number, currentReferenceOnly}` |
| `POST /api/admin/catalog/validate` | `catalog.read` | — | `{errors:[{code, entity, entityCode, message}], warnings:[…], warningsChecksum}` |
| `GET /api/admin/catalog/diff` | `catalog.read` | — | `{added:[{entity, code, name}], removed:[…], changed:[{entity, code, name, fields: string[]}]}` |
| `POST /api/admin/catalog/publish` | `catalog.publish` | `{actionId, expectedCurrentVersion: number \| null, notes (≤500), acknowledgeWarnings: boolean, warningsChecksum?: string}` | 201 `{version, publishedAt, referenceOnly, checksum}`; 422 `publish_blocked`; 409 `stale_release` / `warnings_unacknowledged`. Limit 10/min |
| `GET /api/admin/catalog/releases` | `catalog.read` | `?cursor` | Paged `{version, publishedAt, publishedBy, notes, referenceOnly, restoredFromVersion}` |
| `GET /api/admin/catalog/releases/{version}` | `catalog.read` | — | The above + `validation` + `snapshotUrl` |
| `GET /api/admin/catalog/releases/{version}/snapshot` | `catalog.read` | — | The full `CatalogSnapshot` JSON (download) |
| `POST /api/admin/catalog/releases/{version}/restore` | `catalog.publish` | `{actionId, publishImmediately: boolean, notes}` | `{restored: true, published?: {version}}` (CATALOG-ADMIN §7.5) |

### 3.8 Orders, fulfilment, reviews and customers (TASK-023, TASK-025)

```ts
type OrderAdminDTO = OrderCustomerDTO & {
  id: string; rowVersion: number; customer: { userId: string; name: string; email: string }; needsAttention: boolean;
  shippingAddress: unknown | null; catalogVersion: number; catalogReferenceOnly: boolean;
  items: (OrderCustomerDTO['items'][number] & { id: string; rowVersion: number; supplier: { id: string; name: string } | null;
          supplierReference: string | null; dueDate: string | null; overdue: boolean; allowedTransitions: string[];
          spec: unknown /* measurements redacted without orders.measurements.read */ })[];
  reviewCases: ReviewCaseDTO[]; payments: { id: string; status: string; amountMinor: number; createdAt: string; providerSessionId: string | null }[];
  events: { id: string; type: string; from: string | null; to: string | null; reason: string | null; actor: string; visibleToCustomer: boolean; createdAt: string }[];
  notifications: { id: string; purpose: string; status: string; attempts: number }[];
  snapshots: { version: number; kind: string; createdAt: string }[];
};
type ReviewCaseDTO = { id: string; orderId: string; number: string; snapshotVersion: number;
  status: 'awaiting_payment' | 'pending' | 'in_review' | 'awaiting_customer' | 'completed' | 'cancelled';
  paidAt: string | null; dueAt: string | null; overdue: boolean; assignedTo: { id: string; name: string } | null;
  decision: 'no_changes' | 'changes_proposed' | null; proposedMeasurements: Record<string, number> | null; customerMessage: string | null;
  decidedBy: string | null; decidedAt: string | null; customerResponse: 'accepted_changes' | 'kept_original' | null;
  awaitingCustomerSince: string | null; amendmentSnapshotVersion: number | null; measurementsVerifiedAt: string | null;
  checkAdvice: { title: string; description: string; source: 'rules' | 'ai' }[]; rowVersion: number };
```

| Endpoint | Permission | Request | Response |
| --- | --- | --- | --- |
| `GET /api/admin/orders` | `orders.read` | `?tailorReview&payment&fulfillment&supplierId&overdue&needsAttention&readyToRelease&query(number/email)&from&to&cursor` | Paged `{id, number, submittedAt, customerName, itemCount, totalMinor, currency, tailorReview, payment, fulfillment, suppliers[], nextDueDate, overdue, needsAttention}` |
| `GET /api/admin/orders/{id}` | `orders.read` | — | `OrderAdminDTO` |
| `GET /api/admin/orders/{id}/snapshots/{version}` | `orders.read` | — | `OrderSnapshotV1` (measurements redacted without `orders.measurements.read`) |
| `POST /api/admin/orders/{id}/items/{itemId}/assignment` | `orders.fulfillment.write` | `{rowVersion, supplierId, supplierReference?, dueDate: 'YYYY-MM-DD', reason?}` (a reason is required when changing an existing supplier or date) | Item DTO; 409 `supplier_inactive` / `transition_not_allowed` (after `in_production`) |
| `POST /api/admin/orders/{id}/assignment` | `orders.fulfillment.write` | `{rowVersion, supplierId, dueDate, reason?}` | `OrderAdminDTO` (applied to every current, non-cancelled item) |
| `POST /api/admin/orders/{id}/items/{itemId}/transition` | `orders.fulfillment.write` (`orders.hold` for `on_hold`) | `{rowVersion, to, reason?, tracking?: {carrier, trackingNumber, trackingUrl?} \| {method:'hand_delivery', note}}` | Item DTO; 409 `transition_not_allowed` with `details.allowed` |
| `POST /api/admin/orders/{id}/release` | `orders.fulfillment.write` | `{rowVersion}` | `OrderAdminDTO` (FUL-003 release guard for every item) |
| `PATCH /api/admin/orders/{id}/eta` | `orders.fulfillment.write` | `{rowVersion, customerEtaDate: string \| null, reason}` | DTO |
| `POST /api/admin/orders/{id}/notes` | `orders.notes.write` | `{body (1–2000), visibility:'internal'\|'customer'}` | 201 event |
| `POST /api/admin/orders/{id}/attention/clear` | `orders.fulfillment.write` | `{rowVersion, reason}` | DTO |
| `POST /api/admin/notifications/{id}/retry` | `orders.notifications.retry` | — | `{status}` |
| `GET /api/admin/orders/{id}/items/{itemId}/production-sheet` | `orders.read` + `orders.measurements.read` | `?format=html\|json` | Print HTML (`text/html`, `no-store`) or JSON (FUL-006) |
| `GET /api/admin/reviews` | `reviews.read` | `?status&overdue&assigned=me\|unassigned&cursor` (default `status=pending,in_review,awaiting_customer`; `awaiting_payment` is listed only on request) | Paged `ReviewCaseDTO` (queue order: overdue first, then `dueAt` ascending) |
| `GET /api/admin/reviews/{id}` | `reviews.read` | — | `ReviewCaseDTO` + `snapshot` (current version, including the sign-off and check) + `measurementSources` (the provider snapshot summary: source, capture time and per-field origin; never photos) |
| `POST /api/admin/reviews/{id}/claim` | `reviews.decide` | `{rowVersion}` | DTO (`pending` → `in_review`) |
| `POST /api/admin/reviews/{id}/decision` | `reviews.decide` | `{rowVersion, decision:'no_changes'\|'changes_proposed', proposedMeasurements?: Record<measurementId, mm> (required and non-empty for changes_proposed; ids from the snapshot’s measurement set; 0 < mm ≤ 3000), customerMessage? (required for changes_proposed, ≤1500), notes? (internal, ≤2000), measurementsVerified?: boolean (only with no_changes)}` | DTO; 409 `order_state_invalid` unless the case is `in_review` |
| `GET /api/admin/customers` | `customers.read` | `?query` (email or name, ≥3 characters) | `{items:[{userId, name, email, emailVerified, createdAt, orderCount}]}` (≤25) |
| `GET /api/admin/customers/{userId}` | `customers.read` | — | `{user, orders:[summary], draft:{garments:[{productName, templateName, materialName, quantity}], measurementsConfirmed, updatedAt} \| null}`. Measurement values are never included |

## 4. Authorisation matrix check (AC-18, AC-42)

Contract tests must assert that, for every row in §3, a customer session gets 403 `forbidden`, a staff user without the listed permission gets 403 `forbidden`, a staff user without MFA (when required) gets 403 `mfa_required`, and the listed permission succeeds. Customer order endpoints must return 404 for another user’s order number.
