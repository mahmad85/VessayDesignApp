# TASK-025: Order desk, supplier assignment, deadlines, fulfilment tracking and support lookup

Status: **verified locally** (2026-09-29), WP-44–47. Dependencies are present in the existing working tree; no external verification, merge or release is claimed.

Implementation packages: WP-44 – WP-47 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md), including the user-requested end-to-end hardening evidence.

- Approved baseline: D-019 (assign orders to a supplier, set and update the deadline, order tracking status; support screens).
- Implementation authorisation/source: D-019, D-020, D-021 and the user's explicit M6 WP-44–47 request on 2026-09-29.
- Requirement IDs and canonical files: FUL-001 to FUL-006 and SUP-004 in ORDERS-FULFILLMENT.md; UX-012; ADM-01 (live tiles), ADM-11, ADM-12, the ADM-16 “Assigned items” tab and ADM-18.
- Acceptance scenario IDs: AC-41, AC-44 (the assignment portion), the support portion of AC-18.
- User-visible outcome: an order manager filters orders, assigns each item to an active manufacturer with a deadline (changes need a reason, with history), releases paid items once any requested tailor review is complete (D-020), moves items through production, quality check, shipment (with tracking) and delivery, puts items on hold, and prints production sheets. Customers see friendly tracking. Support staff look up customers and orders without seeing measurements.
- In-scope surfaces/modules: `modules/orders/fulfillment.ts`; order repository fulfilment functions; the admin order and supplier-items endpoints (API-REFERENCE §3.8, §3.3); the production sheet renderer; pages ADM-11, ADM-12, ADM-18 and the ADM-16 tab; customer tracking display.
- Dependencies and blocking questions: Q-030 (confirm the tracking statuses); Q-027 (supplier dispatch channel); Q-029 (cancellation and refund after payment).
- Explicit non-goals: supplier portal or email dispatch; carrier API integration (tracking is entered manually); refunds.
- Data/API/asset contracts: the FUL-003 transition table; `OrderAdminDTO`.
- Loading/error/empty/recovery behaviour: guard explanations; overdue highlighting in the operations timezone; the 390px card layout.
- Authorisation and privacy requirements: `orders.fulfillment.write`, `orders.hold`, `orders.measurements.read` and `customers.read` per the matrix; supplier identity is never shown to customers.
- Migration/compatibility implications: none (0005).
- Test fixtures (synthetic or authorised): synthetic suppliers and orders.
- Verification plan: a transition-table test (every allowed transition plus a denied one per state), including release refused while a tailor review is open and allowed for an order without one; the production sheet uses the amended measurements after an accepted tailor proposal; derived order status; deadline history; the inactive supplier guard; the production sheet matches the snapshot (ORD-005); e2e at 1440 and 390; keyboard pass of ADM-12.
- Actual verification evidence: [M6-EVIDENCE.md](M6-EVIDENCE.md); `npm run check` passed typecheck, lint, 316 tests in 37 files and the optimized build. Full browser suite passed 16/16; final M6 focused run passed 1/1. Fifty responsive captures, axe/overflow checks, keyboard activation, visual inspection, payload-size check, scoped security review, formatting/diff checks and a zero-vulnerability audit are recorded there.
- Deviations and decision references: D-019/D-020/D-021; state extensions remain subject to Q-030 before customer release. The assignment endpoint distinguishes manufacturer reassignment from ongoing deadline changes (FUL-001/002). The explicit staff DTO shape is recorded in API-REFERENCE.
- Remaining limitations: manual supplier communication and refunds; production tracking policy, mail, supplier facts, hosted verification and commercial release approvals remain open. AI stays deferred.
- Changed files/commit: fulfilment and operations repositories, fulfilment policy, production sheet, admin order/customer/dashboard/notification APIs and screens, supplier counts/assigned items, customer tracking, PostgreSQL calendar-date parser, tests and evidence. Included in the combined M3–M6 commit/MR requested by the user on 2026-09-29; no merge or release is claimed.
