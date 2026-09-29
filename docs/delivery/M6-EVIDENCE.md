# M6 fulfilment implementation and evidence — 2026-09-29

Status: **WP-44–47 implemented and locally verified** on 2026-09-29. The last completed package is **WP-47**. No external verification, merge or release is claimed.

- Approved baseline: D-019, D-020 and D-021; ORDERS-FULFILLMENT v0.3 §§3, 7–9; ADMIN-BACKEND §§2–4; API-REFERENCE §§3.3/3.8; ADMIN-SCREENS ADM-01/11/12/16/18. The user explicitly requested M6 WP-44–47 on 2026-09-29. Existing M3/M4/M5 work is preserved in the same working tree.
- Requirements: FUL-001–006, SUP-003/004, ORD-005/011, NTF-001/002, UX-012, ADM-001–005, SEC-001/004/005 and OPS-001/005. Acceptance: AC-17/18/33/41/42/44/46; WP-47 also exercises publication, looks, sign-off and signed synthetic payment.
- AI remains deferred under D-021. M4's independent full acceptance is still open. Implementation here does not supply live supplier/commercial facts or external approvals.

## Package scope

| Package | Implementation |
| --- | --- |
| WP-44 | Pure fulfilment transition table, release guards, operations-timezone deadlines, atomic assignment/release and row versions; admin order/filter/history/ETA/note/attention/retry endpoints, audit events and transactional shipment/cancellation outbox |
| WP-45 | Order desk with saved filters and phone cards; order details, sign-off, specification/history, measurements, review, payment, fulfilment controls and activity; live permission-filtered dashboard tiles |
| WP-46 | Escaped, print-friendly HTML and JSON production sheets using current accepted measurements; supplier assigned-item views/counts; privacy-restricted customer lookup; customer item status, explicit ETA and tracking links |
| WP-47 | Full synthetic browser journey, direct release without tailor review, viewport/keyboard/accessibility checks, projection size measurement, dependency audit and route-security review |

## Local checks

- `tests/fulfillment.test.ts` and `tests/fulfillment-routes.test.ts`: **18 tests passed** in the full suite. Every allowed and denied state pair; release guards; overdue timezone boundary; reason and tracking validation; assignment/deadline history; stale writes; atomic bulk rollback; hold/resume; paid cancellation; accepted amendments and historical snapshots; support redaction; safe HTML; customer privacy; notification failure/retry; actual HTTP permission/MFA/origin matrix.
- `npm audit --json`: **0 vulnerabilities** across 673 reported dependencies. No dependency was added or upgraded.
- `npm test`: **316 tests passed in 37 files**, including 18 M6 domain/route tests and the PostgreSQL calendar-date regression. Added coverage includes concurrent stale-write rejection, supplier deactivation with existing assignments, and atomic rollback of mixed bulk reassignment.
- `npx playwright test`: **16/16 passed** (6.3 minutes), including the complete M6 reviewed and direct-release order paths. After the date-parser fix and additional support search captures, `npx playwright test tests/e2e/fulfillment.spec.ts` also **passed 1/1** (2.0 minutes).
- `npm run check`: passed after the date-parser fix (typecheck, lint, 316 tests and optimized production build). `npm run format:check` and `git diff --check`: passed.
- The published synthetic catalog projection measured **286,407 bytes JSON / 46,901 bytes gzip**, below the 5,000,000-byte release limit. Recorded in [catalog-size.json](../../artifacts/fulfillment/catalog-size.json); this is a payload measurement, not a mobile load-time benchmark.

## Route security review

Reviewed the M6 order, customer, dashboard, supplier-items and notification-retry handlers together with their shared `adminRoute` boundary. Every request resolves verified staff membership and MFA server-side. Mutations require the relevant permission, same-origin validation and a database-backed rate limit; bodies and fields are bounded. Order/item IDs are bound together in the repository. Queries parameterize user inputs, and list filters use fixed SQL fragments. Historical snapshots and production sheets apply measurement permissions; support detail and draft lookup use restricted DTOs. Customer order ownership and omission of supplier/internal data remain covered by the ordering tests and the M6 browser journey. This is a scoped code/contract review, not an external penetration test.

WP-47 also reviewed the existing media upload and order webhook boundaries used by the journey. Uploads require `catalog.write`, staff MFA and origin checks; streamed multipart bodies are capped at 5 MiB, raster signatures/dimensions/extensions/MIME types are checked, SVG is rejected, and media responses use a restricted content policy with `nosniff`. `media-lookup.test.ts` exercises spoofed type, invalid/oversized input, paths and immutable serving. This parser does not perform image re-encoding or malware scanning; production storage and release checks remain separate.

The Stripe order webhook verifies the signature over the bounded raw body, checks test/live mode, binds the event to server-owned order/payment/snapshot/amount/currency/session data, and deduplicates event IDs transactionally. It does not use cookie-origin validation because authentication is the webhook signature. `orders.test.ts` exercises forged and mismatched events, duplicates and asynchronous outcomes; `stripe-orders.test.ts` validates SDK payloads with synthetic fixtures. The M6 browser journey uses a signed synthetic event. No network call to Stripe or external sandbox verification is claimed.

## UI verification and test-discovered fixes

The browser journey publishes a look through the admin UI, starts a customer cart from it, signs off and pays through the test provider, accepts a tailor measurement amendment, then assigns/releases/holds/resumes/ships/delivers/completes the item. A second paid order without a requested tailor review releases directly. Supplier views, dashboard, support lookup and customer tracking are exercised, including a private logistics note that must not reach the customer. The current production sheet contains the accepted chest value of 1030 mm while snapshot v1 retains 1000 mm.

Keyboard checks activate the Fulfilment tab and assignment using Enter. **50 viewport captures** run axe with no violations and assert no horizontal document overflow: staff screens at 1440/768/390, customer tracking also at 320, and production sheets at 1440/390. Representative captures were visually inspected across the order desk, detail tabs, production sheet, hold, shipping form, activity, supplier items, dashboard, support search/detail, customer tracking and direct release. Evidence is synthetic, stored under [artifacts/fulfillment](../../artifacts/fulfillment/).

| View | Representative screenshot |
| --- | --- |
| Order desk, tablet | [order-desk-768.png](../../artifacts/fulfillment/order-desk-768.png) |
| Guarded fulfilment and hold, phone | [fulfillment-hold-390.png](../../artifacts/fulfillment/fulfillment-hold-390.png) |
| Shipping, desktop | [shipping-form-1440.png](../../artifacts/fulfillment/shipping-form-1440.png) |
| Current amended production sheet | [production-sheet-1440.png](../../artifacts/fulfillment/production-sheet-1440.png) |
| Dashboard | [dashboard-1440.png](../../artifacts/fulfillment/dashboard-1440.png) |
| Supplier assigned items | [supplier-items-390.png](../../artifacts/fulfillment/supplier-items-390.png) |
| Support search and account detail | [support-search-390.png](../../artifacts/fulfillment/support-search-390.png), [support-customer-390.png](../../artifacts/fulfillment/support-customer-390.png) |
| Customer tracking, narrow phone | [customer-tracking-320.png](../../artifacts/fulfillment/customer-tracking-320.png) |
| Direct release without tailor review | [direct-release-390.png](../../artifacts/fulfillment/direct-release-390.png) |

Browser verification found and fixed an input race while the previous save was refreshing: the detail fieldset is now disabled until the fresh row versions load, preventing an entered hold reason being lost on remount. It also found a missing main landmark in the printable sheet. Manufacturer choices are disabled once production begins; deadline/reference updates remain available. Bulk release is only displayed while all non-cancelled items await release. The existing studio emits Three.js clock deprecation and React Three Fiber unmount warnings; the M6 journey checks for uncaught page errors separately. Physical devices and production load are unverified.

One extra focused capture run stopped on `ECONNRESET` during a local order-detail read; it was restarted with a fresh synthetic database and passed without changing assertions. The final M6 run reported no uncaught page errors. The full browser suite intentionally blocks a human-model request in its fallback test; that expected error is separate from M6.

## Implementation clarifications and operational limits

The domain requirement FUL-001 limits **manufacturer reassignment** once production begins. FUL-002 still allows a deadline change with a reason. The assignment endpoint therefore accepts deadline/reference updates on a non-terminal item while retaining the same manufacturer, including an inactive existing manufacturer; it rejects new assignment to an inactive manufacturer. The API wording is clarified to match these separate rules. Holds preserve the effective previous state for reassignment checks and resume.

Admin DTOs use explicit allowlists. The staff detail groups immutable sign-off/specification data under `snapshot` and keeps its three status tracks as strings, rather than inheriting the customer response. The runtime shape is recorded in API-REFERENCE. Support receives no structured measurement values, amendment deltas, proposed measurements or provider snapshots. Customer lookup includes only a current-draft summary, never its raw data or transcript. Staff must choose customer visibility explicitly for a note; internal transition reasons are not copied into customer timelines.

The current submitted item set is selected separately from the latest snapshot, because a tailor amendment changes measurements without replacing item rows. Orders are locked before item mutations; supplier rows are locked while checking assignment/release. All bulk changes, derived status, domain events, audit entries and outbox writes commit together. No migration is needed: migration 0005 already contains the required columns. A rollback must preserve existing order history.

The PostgreSQL pool now preserves SQL DATE values as strings. The installed driver's default DATE parser was reproduced in Asia/Karachi converting `2026-10-01` to the instant `2026-09-30T19:00:00Z`, which would display the previous day through UTC formatting. The configured parser keeps supplier deadlines and customer ETAs as calendar dates; timestamp parsers are unchanged. `postgres-types.test.ts` covers ordinary, leap and year-end dates and confirms timestamps still preserve instants. This is a local driver-contract test, not hosted PostgreSQL validation; local PGlite concurrency tests likewise do not prove multi-connection production contention behavior.

Production sheets require both order and measurement access, escape text, use `no-store`, `nosniff` and a restrictive content security policy, and exclude customer email and shipping/contact details. Tracking accepts only http/https links or a bounded hand-delivery note. Outbox delivery remains at least once across process failure; a failed delivery does not change fulfilment state. Partial shipment notifications describe an item, not the entire order.

Release gates remain Q-027 (manual supplier dispatch/contracts), Q-030 (tracking labels, operations timezone and ETA policy), Q-029 (manual refunds/cancellation policy), Q-019 (live payments/commercial inputs), Q-022 (production mail), Q-018 (staffing), Q-032 (legal sign-off), production storage/hosting and operational release evidence. No actual supplier dispatch, carrier integration, real order fulfilment, live payment, customer message or deployment was performed.
