# Cart, orders, review cases, payment, fulfilment and suppliers

Status: proposed v0.3 under D-019 and **D-020** (2026-09-28). Requirements CRT-001 to CRT-004, ORD-006 to ORD-012, PAY-007 to PAY-009, FUL-001 to FUL-006, SUP-001 to SUP-004 and NTF-001 to NTF-002. This file implements, and does not replace: ORD-001 to ORD-005 ([MEASUREMENTS-ORDERS.md](MEASUREMENTS-ORDERS.md)), REV-001 to REV-009 and PAY-001 to PAY-006 ([REVIEW-PAYMENTS.md](REVIEW-PAYMENTS.md) v0.3), and CAT-004 and CAT-005. Pricing is in [PRICING.md](PRICING.md), tables in [ADMIN-BACKEND.md](../architecture/ADMIN-BACKEND.md), and endpoints in [API-REFERENCE.md](../architecture/API-REFERENCE.md).

**Order flow (D-020):** automated check → customer sign-off (design and measurements) → submit → pay → optional tailor review (after payment) → release to production. The customer owns their measurements, so a tailor never gates payment.

Release gates that stay closed: live payment (Q-019), tailor-review staffing and SLA (Q-018), notification provider (Q-022), tax, shipping and refund policy (Q-019), sign-off wording and AI data scope (Q-032), and supplier contracts (Q-027). Development uses Stripe **test mode** only.

## 1. Multi-garment cart

CRT-001: A draft MUST hold 0–10 garments (`draft.garments[]`) with one `activeGarmentId`. Each garment has its own product, template provenance, `catalogVersion`, material, included components, selections, preferences, confirmations and quantity. Switching the active garment never copies or merges selections between garments (CAT-004, UX-004).

CRT-002: Quantity per garment MUST be an integer from 1 to 5. The quantity applies to identical made-to-measure copies of that configuration for the same measurement profile.

CRT-003: Removing a garment that has confirmed choices MUST require explicit confirmation (409 `garment_removal_confirmation_required`, UX-017). Removing the last garment returns the customer to the start screen (S-01).

CRT-004: The draft keeps **one** measurement profile (`draft.measurements`). The required fields are the union of `requiredDefinitionsFor(product.measurement_set)` over all garments. Adding a garment whose product needs fields not yet present marks the measurements unconfirmed and lists the missing fields. Multiple people per cart are out of scope (Q-028).

## 2. Automated check, sign-off and order submission (ORD-006, ORD-012; REV-002 to REV-004, REV-009)

### 2.1 Automated order check (ORD-012)

In Step 3 the customer runs **Check my order** (`POST /api/studio/check`). The server:

1. Runs the deterministic checks of policy `check-policy-v1` (`src/modules/orders/check-policy.ts`) on the current draft. **Blocking** findings: a design not valid or not accepted for any garment (CAT-010); missing or unconfirmed required measurements (CRT-004); an unavailable price or material; reference-only data in production (CAT-017); a garment on a stale catalog version. **Advice** findings: measurements entered manually (“You entered these yourself…”, REV-003 copy); material availability `unknown` or `low_stock`; and, once a tailor defines them, plausibility rules (REV-002).
2. If OpenAI is configured, runs an **AI advisory pass** (at most 20 s, one attempt) that returns at most 5 `advice` findings of ≤300 characters each about design coherence (for example fabric weight against the stated climate). **Scope of data (proposed default, Q-032):** the garments’ products, fabrics, option labels and preferences, plus the measurement source and completeness. **No measurement values.** Output is validated with a schema. The AI cannot create a blocking finding or remove one. On timeout or failure the check still completes, with `aiAdvisory: 'unavailable'`.
3. Stores the result in `draft.review` (ADMIN-BACKEND §7.1) as `{id, inputRevision, policyVersion, status: 'correction_required' | 'passed', findings, aiAdvisory: 'completed' | 'unavailable' | 'not_configured', createdAt}`. Any later draft edit makes it stale (`inputRevision` ≠ revision), and the customer must check again.

### 2.2 Sign-off and submission (ORD-006)

After a passed check, the customer sees each garment’s specification, the measurements with their source, any advice, and the exact total. They tick the **two sign-off confirmations** (REV-009; unticked by default), optionally tick **Add a tailor review** (after payment, before production), and press **Place order and pay $X**. The UI calls `POST /api/orders` and, on success, immediately calls `POST /api/orders/{number}/checkout` (§6). The server checks, in this order, and rejects with the code shown:

| # | Check | Error |
| --- | --- | --- |
| 1 | Signed-in account (guests are asked to sign in; their draft transfers through `claimGuest`) | 401 `sign_in_required` |
| 2 | `expectedRevision` equals the draft revision | 409 `revision_conflict` |
| 3 | At least one garment | 422 `cart_empty` |
| 4 | `checkId` equals `draft.review.id`, and that check is `passed` with `inputRevision` equal to the revision. The deterministic checks are re-run and must still pass (the AI is not re-run) | 409 `check_required` |
| 5 | `signoff.design === true`, `signoff.measurements === true`, and `signoff.statementVersion` equals the current statement version (`signoff-v1`) | 422 `signoff_required` |
| 6 | Every garment is on the current catalog version | 409 `catalog_update_required` |
| 7 | Live availability of every material (CAT-018) | 409 `material_unavailable` |
| 8 | Every garment is priced | 409 `quote_unavailable` |
| 9 | `acceptTotal` equals the recomputed cart total and currency | 409 `quote_changed` (the body includes the new quote) |
| 10 | In production: no reference-only data (CAT-017) | 409 `catalog_not_orderable` |
| 11 | `tailorReview` is a boolean | 422 `invalid_input` |

(Design validity and measurement completeness are enforced by check 4.)

On success, one transaction:

1. Inserts `quotes` (PRC-006).
2. Inserts `orders` (number from `order_number_seq`, formatted `${prefix}-${number padded to 6}`, for example `VS-000123`). `payment_status='checkout_ready'`; `tailor_review_requested`; `tailor_review_status` = `awaiting_payment` when requested, else `not_requested`; `fulfillment_status='not_released'`; `signed_off_at`; `signoff_statement_version`.
3. Inserts one `order_items` row per garment (`snapshot_version = 1`; `line_no` from 1; `unit_price_minor` and `line_total_minor` from the quote; `spec` = the resolved garment spec without measurements, §3).
4. Inserts `order_snapshots` v1 (`kind='submitted'`, full snapshot §3 including `check` and `signoff`, sha256 checksum).
5. When tailor review is requested, inserts `review_cases` with `status='awaiting_payment'` (§4). Inserts `order_events` (`order_submitted`, with the sign-off recorded as a customer-visible event “You signed off your design and measurements”).
6. Records `submit_action_id` (unique) with a request fingerprint.

The draft is **not** reset. `draft.orders[]` gains `{orderId, number, submittedAt}` for navigation. A later draft edit does not touch the order.

**Idempotency (ORD-002):** a repeated `actionId` with the same fingerprint returns the same order (200). A different payload with the same `actionId` returns 409 `action_conflict`.

## 3. Order snapshot content (ORD-001, ORD-005)

`order_snapshots.snapshot` (JSON, immutable, schema `OrderSnapshotV1` in [ADMIN-BACKEND.md §8](../architecture/ADMIN-BACKEND.md#8-order-snapshot-contract)) contains:

- **Order**: id, number, version, kind, submittedAt, currency, `catalogVersion`, `catalogReferenceOnly`, `renderer` version string (the `package.json` version plus the registry hash), `tailorReviewRequested`, and customer `{userId, name, email}`.
- **Check** (from §2.1): `{id, policyVersion, ranAt, aiAdvisory, findings}` (advice only, because a passed check has no blocking findings).
- **Sign-off** (REV-009): `{userId, at, statementVersion, design: true, measurements: true, draftRevision, measurementVersion}`.
- **Amendment** (only when `kind='amendment'`): `{reason: 'tailor_review', reviewCaseId, previousVersion, changedMeasurements: [{id, label, fromMm, toMm}], acceptedAt}`.
- **Garment items**: for each item, lineNo, product `{code, name}`, template `{code, name}` or null, quantity, and material `{code, name, colourName, supplier {id, name}, supplierArticleCode, composition, weightGsm, pattern, weave}`. Components are `{code, name, included}`. Options are, per visible attribute in outline order, `{groupCode, groupName, attributeCode, attributeName, valueCode, valueLabel, text?, supplierCode, lineKind, surchargeMinor}`. Preferences are `{occasion, climate}`, and the item carries its `quote` lines.
- **Measurements**: version, source, confirmed, updatedAt, and the values in **mm** with labels, restricted to the union of required and filled definitions. Provider raw snapshots stay in `measurement_source_snapshots`; photos are never embedded (ORD-001).
- **Totals**: subtotalMinor, shippingMinor, totalMinor, `quoteId`, and `expiresAt`.

The item `spec` column holds the item portion of this snapshot, **without measurements**. Measurements always come from the order’s **current** snapshot version (`orders.current_snapshot_version`), so an accepted tailor amendment (§4) changes them without rewriting item rows or losing supplier assignments. Supplier production sheets (FUL-006) combine the item `spec` with the current snapshot’s measurements. Styling-only items are never included. Accessories chosen in accent groups with `line_kind='accessory'` are purchased items and are listed under a separate “Accessories” heading.

## 4. Optional tailor review after payment (ORD-008; implements REV-005 to REV-007)

`review_cases` holds **tailor reviews only**: at most one open case per order, bound to `(order_id, snapshot_version)`. The automated check is not a case; it is recorded in the snapshot (§3).

States:

| From | To | Trigger |
| --- | --- | --- |
| — | `awaiting_payment` | Submission with `tailorReview: true` |
| `awaiting_payment` | `pending` | Payment `succeeded` (in the webhook transaction). Sets `due_at = paid_at + 24h` (elapsed hours, the REV-006 proposed default) |
| `pending` | `in_review` | A tailor claims the case (`assigned_to`) |
| `in_review` | `completed` | Decision `no_changes` |
| `in_review` | `awaiting_customer` | Decision `changes_proposed` |
| `awaiting_customer` | `completed` | The customer responds `accept_changes` (creates an amendment) or `keep_original` |
| any state except `completed` | `cancelled` | The order is cancelled, or the pre-payment order is resubmitted (a new case is created if requested again) |

The order mirrors the case in `orders.tailor_review_status` (`not_requested` when no case exists).

**Tailor decision** (ADM-14, permission `reviews.decide`):

- `no_changes`: optional internal notes, and an optional **Measurements verified by tailor** flag, which records `measurements_verified_by`/`_at` and shows a “Tailor verified” badge for that measurement version (MEAS-004, UX-008) without changing any value. The notification is `tailor_review_completed`.
- `changes_proposed`: a customer message (required) and `proposedMeasurements: Record<measurementId, mm>` (non-empty; only ids present in the snapshot’s measurement set; the same numeric bounds as the `measurements` command). Design changes with a price impact are out of scope and are handled manually by staff with `needs_attention` (Q-029). The notification is `tailor_review_needs_input`.

**Customer response** (`POST /api/orders/{number}/tailor-review/respond`), only while `awaiting_customer`:

- `accept_changes`: in one transaction, creates `order_snapshots` v(n+1) with `kind='amendment'` (the previous snapshot plus the updated measurement values, the `amendment` block from §3, a new checksum and the same quote), sets `orders.current_snapshot_version = n+1`, records the case as `completed` with `customer_response='accepted_changes'` and `amendment_snapshot_version`, and writes the events. Item rows and supplier assignments are untouched (§3). The customer’s draft is **not** changed; the customer is offered **Update my saved measurements too**, which runs a normal `measurements` command.
- `keep_original`: records `customer_response='kept_original'` and sets the case to `completed`. The signed-off values stand, because the customer owns the measurements (D-020).

Overdue means `now > due_at` while the case is `pending` or `in_review`. Overdue cases are highlighted in the queue and on the dashboard. The customer receives one `tailor_review_delayed` notification and sees “Taking longer than expected” (REV-006). Time spent in `awaiting_customer` is shown separately, as “Waiting for your answer since …”. **There is no automatic completion or release at any deadline.** Reminders and an eventual default for customers who never respond are an operations decision (Q-018).

## 5. Resubmission, cancellation and customer views

ORD-009: **Before payment succeeds** (`payment_status ∈ {checkout_ready, failed, cancelled}`, with no payment pending), the customer may **update and resubmit** the order from their current draft. Typical reasons are an expired quote, a change of mind after an abandoned checkout, or turning tailor review on or off. The same check, sign-off and submission rules as §2 apply. The server creates `order_snapshots` v(n+1) (`kind='submitted'`) and a new quote, inserts a new set of `order_items` rows for version n+1, and sets `orders.current_snapshot_version = n+1`. Items are unique per `(order_id, snapshot_version, line_no)`, so no row is ever deleted or rewritten. It cancels any `awaiting_payment` case and creates a new one when tailor review is requested. After payment has succeeded, resubmission is refused (409 `order_state_invalid`). Paid orders change only through the tailor-review amendment (§4), or through staff handling under PAY-005 and Q-029.

ORD-010: The customer may **cancel** an order before any payment succeeds (`payment_status ∈ {checkout_ready, failed, cancelled}`). This sets `fulfillment_status='cancelled'`, expires any open Stripe session (PAY-008), and cancels an `awaiting_payment` tailor-review case. An unpaid order whose quote has expired shows “Price expired — update your order” (ORD-009). Unpaid orders are not cancelled automatically in this scope.

ORD-011: Customers see `/orders` (their orders, newest first) and `/orders/{number}`. The detail page shows the tracks Payment, Tailor review (only when requested) and Production, a timeline of customer-visible events (including the sign-off), the items with a readable specification (the same data as the snapshot, UX-009), the measurements of the current snapshot, the next action (Pay, Respond to the tailor, Update and resubmit, Cancel), and tracking details once shipped. Access is limited to the owner, and a non-owner gets 404 `order_not_found`, so orders cannot be enumerated.

## 6. Payment with Stripe Checkout (PAY-007 to PAY-009; implements PAY-001 to PAY-006)

PAY-007 (provider binding and guard): Garment payments use Stripe Checkout Sessions (hosted), so card data never touches this application (PAY-001). The server refuses to create sessions when:

- `STRIPE_SECRET_KEY` is missing → 503 `payments_disabled`;
- a live key (`sk_live_`) is present while `NODE_ENV !== 'production'` → 503 `payments_disabled` (no real charge during development, AGENTS.md);
- `NODE_ENV === 'production'` and `PAYMENTS_LIVE_ENABLED !== 'true'` → 503 `payments_disabled` (Q-019 gate).

PAY-008 (checkout creation), `POST /api/orders/{number}/checkout {actionId}`. Preconditions: the caller owns the order; `payment_status ∈ {checkout_ready, failed, cancelled}` or a pending payment exists (409 `order_state_invalid` otherwise, for example for a cancelled order); the current snapshot is the signed-off `submitted` version; the quote is valid (409 `quote_expired`); and live availability holds. **No review approval is required** (D-020). Then:

- If a payment with `status='payment_pending'` exists, the server retrieves its session from Stripe (reconcile first, PAY-003). If the session is `open`, it returns the same URL. If it is `complete`, it applies reconciliation and returns 409 `payment_pending` or the paid state. If it is `expired`, it marks the payment `cancelled` and continues.
- Otherwise it inserts `payments` (`status='payment_pending'`, `amount_minor = quote total`, currency, `snapshot_version`, `idempotency_key = payment.id`) and creates the session with Stripe idempotency key = `payment.id`:
  - `mode:'payment'`, `line_items`: one per order item (`price_data {currency, unit_amount: unit_price_minor, product_data {name: "<Product> — <Template name | Custom>", description: material name}}`, `quantity`);
  - when `shippingMinor > 0`: `shipping_options: [{shipping_rate_data: {type:'fixed_amount', fixed_amount: {amount: shippingMinor, currency}, display_name: 'Delivery'}}]`;
  - `shipping_address_collection: {allowed_countries: commerce_settings.ship_countries}`, `customer_email`, `client_reference_id: order.id`;
  - `metadata: {kind:'garment_order', orderId, paymentId, snapshotVersion}`;
  - `success_url: ${APP_URL}/orders/${number}?checkout=returned`, `cancel_url: ${APP_URL}/orders/${number}?checkout=cancelled`.
- It stores `provider_session_id` and returns `{checkoutUrl}`. `orders.payment_status` becomes `payment_pending`.

Returning to `success_url` is **not** proof of payment (PAY-003). The order page polls `GET /api/orders/{number}` and shows “We are confirming your payment”.

PAY-009 (reconciliation), `POST /api/payments/stripe/webhook`, with a separate endpoint secret `STRIPE_ORDER_WEBHOOK_SECRET`:

1. Verify the signature. If `event.livemode` does not match the environment (live only in production with `PAYMENTS_LIVE_ENABLED`), return 400.
2. Ignore (200) any event whose `metadata.kind` is not `garment_order`.
3. Deduplicate with `INSERT … stripe_webhook_events ON CONFLICT DO NOTHING` (the table already exists). A duplicate returns 200 with no effect.
4. Load the payment by `metadata.paymentId`. It must match `orderId`, `provider_session_id`, currency, and `amount_total` = `payments.amount_minor` (the order total, including shipping). On a mismatch, record `order_events(payment_anomaly)`, set `orders.needs_attention = true`, and return 200 without changing the payment state.
5. Transitions:
   - `checkout.session.completed` with `payment_status='paid'` → `succeeded`;
   - `checkout.session.completed` with `unpaid` → stays `payment_pending` (async);
   - `checkout.session.async_payment_succeeded` → `succeeded`;
   - `checkout.session.async_payment_failed` → `failed`;
   - `checkout.session.expired` → `cancelled` (only if still `payment_pending`);
   - `charge.refunded` (full) → `refunded`, recorded only.
   On `succeeded`, store `shipping_details` into `orders.shipping_address`, add `payment_intent` to the payment, set `orders.payment_status='succeeded'`, move an `awaiting_payment` tailor-review case to `pending` with `due_at = now + 24h` (§4), record the events, and create the `payment_received` notification (PAY-004 copy, including the tailor-review sentence when requested). Late or out-of-order events never move a payment backwards from `succeeded` or `refunded`.
6. Refund initiation, partial refunds and disputes are **out of scope**. Staff use the Stripe dashboard, and the admin order page links to the Stripe payment (Q-019, Q-029).

Payment states (REVIEW-PAYMENTS.md): `checkout_ready` (set at submission, after the passed check and sign-off) `→ payment_pending → succeeded | failed | cancelled`; `failed|cancelled → payment_pending` (new attempt); `succeeded → refunded`. `not_started` stays in the state list for completeness but is not used by orders under D-020. `refund_pending` is reserved.

## 7. Fulfilment and tracking (FUL-001 to FUL-006)

FUL-001 (supplier assignment): After payment, each **order item** is assigned to one supplier (`order_items.supplier_id`) of kind `manufacturer`, optionally with an internal `supplier_reference` (their job number). Assignment may happen while a tailor review is open. Release may not (FUL-003). Only `active` suppliers can receive new assignments (409 `supplier_inactive`). Reassignment is allowed until `in_production`, and requires a reason. “Assign all items” is a convenience that runs the same per-item command.

FUL-002 (deadlines): Each assigned item has `supplier_due_date` (a date in the operations timezone `commerce_settings.ops_timezone`, default `UTC`). Setting or changing it requires a reason when a value already exists. Every change writes `order_events(deadline_changed, from, to, reason, actor)`, so the full history is visible. An item is overdue when `today > supplier_due_date` and its status is one of `released`, `in_production`, `quality_check`. A separate optional `customer_eta_date` is shown to the customer **only** when staff set it; it is never derived or invented.

FUL-003 (item status machine, **proposed**; the ops owner confirms before customer release, Q-030):

| From | To | Who | Guard |
| --- | --- | --- | --- |
| `not_released` | `released` | order_manager | payment `succeeded`; `tailor_review_status ∈ {not_requested, completed}`; supplier assigned and active; due date set |
| `released` | `in_production` | order_manager | — |
| `in_production` | `quality_check` | order_manager | — |
| `quality_check` | `in_production` | order_manager | reason (rework) |
| `quality_check` | `ready_to_ship` | order_manager | — |
| `ready_to_ship` | `shipped` | order_manager | tracking `{carrier, trackingNumber, trackingUrl?}` or `{method:'hand_delivery', note}` |
| `shipped` | `delivered` | order_manager | — |
| `delivered` | `completed` | order_manager | — |
| `released`, `in_production`, `quality_check`, `ready_to_ship` | `on_hold` | order_manager, tailor | reason; the resume target is stored |
| `on_hold` | the stored previous state | order_manager | — |
| any state except `shipped`, `delivered`, `completed` | `cancelled` | owner, order_manager | reason; after `succeeded` payment it flags `needs_attention` for a manual refund |

Every other transition returns 409 `transition_not_allowed`. The order-level `fulfillment_status` is derived in the same transaction: `cancelled` if all items are cancelled; otherwise `on_hold` if any item is on hold; otherwise the least-advanced status among non-cancelled items, in the order above. `completed` requires all non-cancelled items to be completed.

FUL-004 (customer tracking): Customer labels are: `not_released` → “Preparing your order” (only after payment), or “Waiting for your tailor review” while the tailor review is open; `released`/`in_production` → “In production”; `quality_check` → “Final checks”; `ready_to_ship` → “Preparing shipment”; `shipped` → “Shipped” with a carrier link; `delivered`/`completed` → “Delivered”; `on_hold` → “On hold — we may contact you”; `cancelled` → “Cancelled”. No production claim appears before `released` (PAY-004). Internal notes and supplier identity are **never** shown to customers.

FUL-005 (events and notes): `order_events` is append-only and records every state change, assignment, deadline change, note, payment event and review decision, with the actor type and id. Notes are `internal` or `customer` visible (UX-012: attributable and dated).

FUL-006 (production sheet): `GET /api/admin/orders/{id}/items/{itemId}/production-sheet?format=html|json` renders from the item `spec` and the measurements of the order’s **current** snapshot only (ORD-005: the export matches what the customer signed off, or the amendment they accepted). The sheet states the measurement source, the customer sign-off date, and “Tailor verified” or “Amended after tailor review” when either applies. The HTML is print-friendly, has no customer contact details beyond name and order number, and uses no new PDF dependency. Sending it to a supplier is manual in this scope (Q-027).

## 8. Suppliers (SUP-001 to SUP-004)

SUP-001: A supplier has `code` (unique, immutable once referenced), `name` (required), `legal_name`, `kind` (`fabric_mill | fabric_merchant | manufacturer | accessory | other`), `status` (`active | inactive`), `website`, address (`address_line1` required for active, `address_line2`, `city` required, `region`, `postal_code`, `country_code` ISO-3166 alpha-2 required), `default_lead_time_days`, `capabilities` (product codes it can make, for manufacturers), and `notes` (internal).

SUP-002: A supplier has at most one **primary** and one **secondary** contact (`supplier_contacts.rank`). A primary contact is required for `active`. Each contact has `name` (required), `role_title`, `email` (valid format), `phone` (E.164-like, 7–20 characters of digits, space, `+`, `-`, `(`, `)`), `preferred_channel` (`email|phone`) and `notes`. Contacts are business personal data: visible to staff with `suppliers.read`, never exposed to customers or the AI assistant, and excluded from logs.

SUP-003: Suppliers are never hard-deleted once referenced (materials or order items). Setting them `inactive` blocks new assignments and new material links, and keeps history.

SUP-004: The supplier detail page lists linked materials and assigned order items (open, overdue, completed), with filters. This is the “basic supplier management” of D-019. Supplier portals, supplier logins, automatic dispatch and invoicing are out of scope (Q-027).

## 9. Notifications (NTF-001, NTF-002; implements PAY-006)

NTF-001: Customer notifications are written as `notifications` rows in the **same transaction** as the state change (transactional outbox, ARCHITECTURE.md). The purposes are `payment_received`, `payment_failed`, `tailor_review_needs_input`, `tailor_review_completed`, `tailor_review_delayed` (overdue), `order_shipped` and `order_cancelled`. An unpaid order sends no notification. The payload is minimal: order number, status and a secure link to `/orders/{number}` (the customer must sign in). It contains no measurements and no prices beyond the total.

NTF-002: After commit, the handler attempts delivery through the existing mail adapter (`src/integrations/mail.ts`; in development it writes to `.data/mail`). The outcome is recorded as `sent` or `failed` with an attempt count. Staff can retry failed notifications from the order page. A delivery failure never changes order state. A production email provider is gated by Q-022. SMS and WhatsApp are out of scope.

## 10. Status summary

| Track | Column | Values |
| --- | --- | --- |
| Automated check | `draft.review.status` (draft only; copied into the snapshot at submission) | `correction_required`, `passed` (stale when `inputRevision` ≠ the draft revision) |
| Tailor review | `orders.tailor_review_status` (mirrors the open case) | `not_requested`, `awaiting_payment`, `pending`, `in_review`, `awaiting_customer`, `completed`, `cancelled` |
| Payment | `orders.payment_status` | `not_started`, `checkout_ready`, `payment_pending`, `succeeded`, `failed`, `cancelled`, `refund_pending`, `refunded` |
| Fulfilment | `orders.fulfillment_status` (derived), `order_items.fulfillment_status` | `not_released`, `released`, `in_production`, `quality_check`, `ready_to_ship`, `shipped`, `delivered`, `completed`, `on_hold`, `cancelled` |

These tracks are independent facts (ORD-003). None is inferred from another except through the guards above.

Mapping to earlier proposals: `on_hold` is REVIEW-PAYMENTS.md’s `clarification_hold`. The v0.2 pre-payment review states (`expert_required`, `human_pending`, `approved`, `declined`, `stale`, `failed`) are superseded by D-020. The fulfilment states `quality_check`, `ready_to_ship`, `shipped`, `delivered` and `cancelled` extend the earlier list to meet the D-019 “order tracking status” request, and remain proposed until Q-030 is resolved.
