# TASK-023: Automated check, customer sign-off, order submission, post-payment tailor review and customer orders

Status: ready (specified 2026-09-28, revised by D-020; depends on TASK-018 and TASK-022)

Implementation packages: WP-38 – WP-41 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019 and **D-020**; REVIEW-PAYMENTS.md v0.3; MEASUREMENTS-ORDERS.md ORD-001 to ORD-005.
- Implementation authorisation/source: D-019 (order submission, admin order desk, tailor and support screens); D-020 (customer owns measurements and signs off; the automated check is enough to pay; optional tailor review after payment).
- Requirement IDs and canonical files: ORD-001, ORD-002, ORD-003, ORD-005, ORD-006 to ORD-012, CAT-017, CAT-018, PRC-006, NTF-001 and NTF-002 in ORDERS-FULFILLMENT.md; REV-001 to REV-007 and REV-009 in REVIEW-PAYMENTS.md; ADM-13, ADM-14, S-08, S-09 and S-13.
- Acceptance scenario IDs: AC-15, AC-16, AC-17 (the snapshot part), AC-25, AC-26 (up to payment; the paid part completes with TASK-024), AC-33 (development mail), AC-39, AC-46.
- User-visible outcome: in Step 3 the customer runs **Check my order**, fixes blocking findings, reads the advice, ticks the design and measurement sign-offs, optionally adds a tailor review, and places the order with the exact total. The order page tracks payment, tailor review and production. Once an order is paid (TASK-024; the fake provider in tests), a tailor claims the review, and either finds no changes or proposes measurement changes. The customer accepts them (an amendment snapshot) or keeps their own values.
- In-scope surfaces/modules: `migrations/0005_orders.sql`; `modules/orders/{check-policy,submission,tailor-review,customer-status}.ts`; `integrations/assistant.ts#adviseOrderCheck`; `db/order-repository.ts`; `modules/notifications/dispatch.ts`; `POST /api/studio/check` (removes the `review` command from `CommandV2` and replaces the pre-payment automated/human mode UI in `review-panel.tsx`); endpoints API-REFERENCE §2.4 and the reviews rows of §3.8; pages `/orders`, `/orders/[number]` (including the tailor-proposal response), ADM-13 and ADM-14; the S-08 check, sign-off, tailor-review option and place-order flow.
- Dependencies and blocking questions: Q-018 (tailor-review staffing and SLA); Q-022 (production mail); Q-032 (sign-off wording; no measurement values sent to the AI); Q-033 (tailor review is free by default).
- Explicit non-goals: Stripe itself (TASK-024; the webhook transition `awaiting_payment → pending` is implemented here as a repository function that TASK-024 calls); fulfilment and the order desk (TASK-025); design amendments with a price impact (Q-029).
- Data/API/asset contracts: `OrderCheck` and `OrderSnapshotV1` (ADMIN-BACKEND §7.1, §8); ORDERS-FULFILLMENT §2–5 and §9.
- Loading/error/empty/recovery behaviour: each blocking finding links to its field (UX-010); editing after a check clears the check and the sign-off visibly; `quote_changed` asks for re-confirmation; an unavailable AI advisory is shown as “Advice unavailable right now — your order check still passed”; the overdue and awaiting-your-answer copy.
- Authorisation and privacy requirements: owner-only orders (404 otherwise); `reviews.read`/`reviews.decide`; measurements visible to tailors only; the AI advisory input excludes measurement values (Q-032).
- Migration/compatibility implications: additive migration 0005. The draft `review` field changes to the `OrderCheck` shape, and older stored v2 reviews are treated as `null` (the customer re-runs the check).
- Test fixtures (synthetic or authorised): synthetic customers, catalogs and prices; a stubbed AI advisory (success, timeout, and attempted blocking or approving output).
- Verification plan: check-policy findings (blocking versus advice; AI can neither block nor clear); every submission check (1–11) tested, including a stale check and each missing sign-off; the sign-off stored with statement version, revision and measurement version; idempotent replay and a concurrent double submit (one order); the snapshot unchanged after publishing a new catalog (AC-17); pre-payment resubmit creates v2 and cancels an `awaiting_payment` case; cancel rules; the tailor-review state table (claim, both decisions, both customer responses, amendment v2 leaves item rows intact, overdue flag without completion); notification deduplication; e2e: check → sign-off with tailor review → place order → (fake payment) → tailor proposes → customer accepts → amendment visible.
- Actual verification evidence: not started.
- Deviations and decision references: D-019, D-020.
- Remaining limitations: live notification delivery, SLA staffing and the legal sign-off wording.
- Changed files/commit: —
