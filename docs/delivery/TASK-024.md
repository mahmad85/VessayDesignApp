# TASK-024: Stripe Checkout payment and reconciliation (test mode)

Status: verified locally with synthetic payments (2026-09-29; external Stripe sandbox not verified; not merged or released)

Implementation packages: WP-42, WP-43 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019 (the user selected payment integration; Stripe); D-020 (pay after the automated check and sign-off); REVIEW-PAYMENTS.md v0.3 PAY-001 to PAY-006.
- Implementation authorisation/source: D-019. Live charges are **not** authorised (Q-019).
- Requirement IDs and canonical files: PAY-001 to PAY-004, PAY-006 and PAY-007 to PAY-009 in ORDERS-FULFILLMENT.md §6; S-12.
- Acceptance scenario IDs: AC-27, AC-28, AC-40.
- User-visible outcome: straight after placing a checked and signed-off order (D-020: no approval wait), the customer pays through Stripe hosted Checkout in test mode. On success, a requested tailor review opens (`awaiting_payment → pending`, due in 24 hours). The order shows “confirming” until the verified webhook marks it paid. Duplicate clicks never create a second payable session.
- In-scope surfaces/modules: `migrations/0006_payments.sql`; `integrations/payments/{stripe-orders,fake}.ts`; `db/payment-repository.ts`; `POST /api/orders/[number]/checkout`; `POST /api/payments/stripe/webhook`; removal of `POST /api/checkout` and `integrations/checkout.ts` (410 `endpoint_removed`; update the e2e test that expected the old 409/503); the order page pay and confirming states.
- Dependencies and blocking questions: Q-019 (merchant, currency, tax, shipping, refunds, live keys).
- Explicit non-goals: refunds from the admin, partial captures, saved cards, Stripe Tax, garment credits from the scan service (D-017 stays inert).
- Data/API/asset contracts: `PaymentProvider` (ADMIN-BACKEND §10); API-REFERENCE §2.5.
- Loading/error/empty/recovery behaviour: `payments_disabled` copy; a cancelled return; polling limits.
- Authorisation and privacy requirements: webhook signature and livemode checks; no card data stored; the live-key guard outside production (PAY-007).
- Migration/compatibility implications: additive 0006; `.env.example` gains `STRIPE_ORDER_WEBHOOK_SECRET`, `PAYMENTS_LIVE_ENABLED` and `PAYMENT_PROVIDER`.
- Test fixtures (synthetic or authorised): signed synthetic events via `stripe.webhooks.generateTestHeaderString`; the fake provider in e2e. A manual test-mode run with the owner’s Stripe **test** keys is optional and must be recorded as sandbox evidence.
- Verification plan: checkout works without any tailor approval, and a paid webhook opens the tailor review exactly once (also for duplicate events); tests for the guard matrix; reuse of an open session; a duplicate event; out-of-order events (`expired` after `completed`); an amount or currency mismatch → `needs_attention`; a livemode mismatch → 400; the redirect alone does not mark paid; e2e with the fake provider.
- Actual verification evidence: [M5-EVIDENCE.md](M5-EVIDENCE.md), WP-42–43. The adapter contract is checked with the installed Stripe SDK and a stubbed transport; signed synthetic webhook events exercise reconciliation. The browser purchase uses the guarded fake provider and a signed webhook, and confirms that the checkout return alone never marks an order paid.
- Deviations and decision references: D-019.
- Remaining limitations: no external Stripe test account/session was used. Live payments, refund operations, tax, shipping policy and production notification delivery remain gated. No card data, real customer mail or charges were sent.
- Changed files/commit: migration 0006, payment adapters/repository/webhook and checkout routes, customer payment states and tests; old checkout now returns 410; local working tree, not merged or released.
