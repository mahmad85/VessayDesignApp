# M5 ordering implementation and evidence — 2026-09-29

Status: WP-37 and WP-39–43 implemented and locally verified; WP-38's non-AI scope is locally verified and its OpenAI adapter is deferred by the user under D-021 until the remaining functionality is complete. The original full M5 scope is not closed; deferred AI does not block independent non-AI work. No external verification, merge or release is claimed.

- Approved baseline: D-019 and D-020, ORDERS-FULFILLMENT v0.3, REVIEW-PAYMENTS v0.3, ADMIN-BACKEND §§4.3–4.4, 7.1, 8, 10–11, API-REFERENCE §§2.4–2.5 and 3.8, ADMIN-SCREENS S-02/S-08/S-09/S-12 and ADM-13/14.
- Implementation authorization: the user's explicit request to continue M5 WP-37–43 on 2026-09-29. Work continues in the existing `codex/m3-m4-admin-catalog` working tree; existing M3/M4 work is preserved. This does not close M4's outstanding acceptance evidence or imply those dependencies are merged.
- Requirement IDs: CRT-001–004; ORD-001–003, ORD-005–012 (M5 portions); REV-001–007 and REV-009; PRC-006; CAT-017/018; PAY-001–004, PAY-006–009; NTF-001/002 (outbox/local delivery); staff review authorization and measurement privacy. Fulfilment release and the staff retry UI remain M6.
- Acceptance cases: AC-01/38 cart; AC-15/16/17/25/26/39 sign-off and immutable orders; AC-27/28/40 payments; AC-33 local mail; AC-46 tailor proposals and customer choice. These are local synthetic coverage, not external product acceptance.
- Non-goals: live charges, real customer email, real scans, production fulfilment, tax/refund operations, supplier dispatch and paid tailor review.

## Package results

| Package | Implemented scope | Evidence and remaining work |
| --- | --- | --- |
| WP-37 | Cart chips with prices, add/remove dialog, switching, quantity, shared measurement union and garment-by-garment review | `configuration.test.ts`, `orders.spec.ts`: suit plus two independently configured shirts, keyboard switching, confirmed removal, two shirts priced as quantity 2, shared Neck field and $1,057 synthetic total |
| WP-38 | Migration 0005; deterministic policy; idempotent `/api/studio/check`; edits clear checks; correction links; bounded injectable advisory contract | `order-advisory.test.ts`, `orders.test.ts`, `order-routes.test.ts`. Privacy projection omits body values, contact details, supplier identity, conversation and personalised text. Invalid or unavailable advice cannot approve/block an order. **The actual OpenAI order-advice adapter is not connected**; normal requests report `not_configured`. |
| WP-39 | Two explicit sign-offs, optional tailor review, atomic submission/number/quote/snapshot/items/events, resubmit and cancellation | `orders.test.ts`: ordered guards and error codes, replay/concurrent submission, stored sign-off versions, unchanged history after resubmit and catalog publish, ownership and currency locking |
| WP-40 | Customer list/details, readable historical specifications and measurements, independent status tracks/timeline, quote expiry and recovery; notification outbox | Repository/HTTP tests, signed-in browser pages; mail failure leaves payment state intact; customer DTO excludes internal notes, supplier/contact data and provider IDs |
| WP-41 | Staff queue and filters/paging, claim and versioned decisions, optional verification marker, measurement proposal, accept/keep, amendment snapshot, overdue notification | Complete transition table tests; both decisions and both customer responses; amendment leaves item rows and saved draft untouched. Browser uses real Better Auth TOTP with a synthetic staff account. |
| WP-42 | Migration 0006, Stripe adapter and test-only provider, durable attempts, checkout reuse/reconciliation and provider idempotency | `stripe-orders.test.ts`, `orders.test.ts`: guard matrix, contract fields, timeout recovery with the same payment ID, reuse, quote expiry and payment without tailor approval |
| WP-43 | Signature/livemode/binding checks, webhook dedupe, success/async failure/expiry/refund observations, anomaly marking, once-only review opening, pending return UI, old checkout 410 | Signed synthetic events and the browser purchase. Redirect alone remains pending; verified payment opens review exactly once. External Stripe sandbox remains unverified. |

## Verification actually executed

- Final `npm run check`: passed typecheck, lint, all **297 tests in 34 files**, and the optimized production build. Both customer order routes render dynamically, including builds without auth secrets.
- Full `npx playwright test` with `VESSY_E2E_ARTIFACT_DIR=test-results/regression`: **15/15 passed**. The complete cart → sign-off → synthetic payment → tailor proposal → accepted amendment journey passed at customer widths 1440/768/390/320 and staff widths 1440/1024/768, with axe reporting no violations and no horizontal overflow. Keyboard coverage includes cart switching, dialogs, sign-in/staff controls and customer acceptance.
- `npm run format:check` and `git diff --check`: passed. Formatting-only normalization includes the existing working-tree admin files needed by the CI formatting gate; their behavior is preserved.
- First unrestricted full test attempts hit 30-second PGlite startup/resource timeouts. Limiting Vitest to two workers made the full suite pass; assertions and timeouts were not relaxed.
- No external Stripe or OpenAI calls were made for M5. The installed Stripe SDK validates signatures and the adapter contract uses a stubbed transport. No claim of sandbox integration success follows from these tests.

Thirty synthetic screenshots are saved in `artifacts/ordering/`. Visual inspection covered the required customer and staff widths. Representative views: [cart at 320](../../artifacts/ordering/cart-320.png), [sign-off at 390](../../artifacts/ordering/signoff-390.png), [sign-off at 768](../../artifacts/ordering/signoff-768.png), [paid order at 1440](../../artifacts/ordering/paid-order-1440.png), [queue at 1024](../../artifacts/ordering/tailor-queue-1024.png), [tailor decision at 768](../../artifacts/ordering/tailor-proposal-768.png), [customer proposal](../../artifacts/ordering/customer-proposal-390.png) and [amended order](../../artifacts/ordering/amended-order-320.png). The studio's existing Three.js deprecation and React Three Fiber unmount development warnings remain visible in development artifacts; no uncaught page error occurred in the M5 journey. The separate asset-failure regression intentionally blocks the model to test its fallback.

## Implementation and recovery notes

Orders are built from a server-loaded current release and uncached availability under the catalog publication lock. Commercial changes return their specific recovery errors after design/measurement readiness checks, retaining the canonical submission guard order. Checking does not increment the draft revision; the check ID and input revision bind the sign-off, and any subsequent command or conversation change clears it.

Payment attempts commit before provider calls. Retries reuse the payment ID as Stripe's idempotency key; an unknown attempt older than 23 hours requires reconciliation instead of another payable session. Webhooks arriving before the session binding is saved return 503 for retry. The return page cannot mark payment successful. No production release occurs here. Verified full refunds bind through the previously recorded PaymentIntent when Charge metadata is empty; this observes a refund, it does not initiate one.

Review decisions and customer responses lock the order before the case and check row/snapshot versions. An accepted proposal creates an amendment retaining the quote, original sign-off and previous versions. Updating the saved measurement profile is a separate explicit customer command.

`npm run orders:maintain` processes overdue cases and pending notifications. Failed deliveries retain their status and attempt count; the staff retry action belongs to M6. No scheduler is installed or enabled. Production needs a configured runner and approved mail transport. Non-production order mail writes `.data/mail`; outbox delivery is at least once across a process failure, and provider-level exactly-once delivery is not claimed.

Migrations 0005/0006 are additive and mirrored in Drizzle. Migration tests execute both whole-file and semicolon-split paths repeatedly. Hosted PostgreSQL, backups, retention and migration recovery need external validation; do not roll back by deleting historical orders or snapshots. No runtime dependency was added.

## Remaining dependencies and limitations

The user deferred AI features on 2026-09-29 under [D-021](../product/DECISIONS.md#d-021--defer-ai-features-until-the-remaining-functionality-is-complete-accepted-2026-09-29). WP-38's OpenAI adapter and live evaluation remain deferred until the remaining functionality is complete. Advice stays unconfigured; the deterministic check and provider-independent advisory contract remain implemented. No credential choice is pending for the current work, and this deferral does not block independent non-AI packages starting with M6 WP-44. The AI requirements remain tracked for later completion.

Q-011/019 commercial data and live payment; Q-018 review staffing/24-hour service; Q-022 mail; Q-032 legal sign-off; Q-033 any review fee; hosted PostgreSQL and production storage/release remain open. M4 acceptance is still open. M6 fulfilment is not implemented by this task. Browser evidence uses synthetic users, stock status, prices and measurements only.

- Changed files/commit: migrations 0005/0006, `src/modules/orders`, `src/modules/notifications`, `src/integrations/payments`, order/payment repositories, corresponding API routes, customer cart/orders and admin reviews, tests and these evidence documents. Included in the combined M3–M6 commit/MR requested by the user on 2026-09-29; no merge or release is claimed.
