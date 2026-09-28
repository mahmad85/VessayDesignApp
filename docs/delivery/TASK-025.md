# TASK-025: Order desk, supplier assignment, deadlines, fulfilment tracking and support lookup

Status: ready (specified 2026-09-28; depends on TASK-020 and TASK-024)

Implementation packages: WP-44 – WP-46 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019 (assign orders to a supplier, set and update the deadline, order tracking status; support screens).
- Implementation authorisation/source: D-019.
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
- Actual verification evidence: not started.
- Deviations and decision references: D-019; state extensions pending Q-030.
- Remaining limitations: manual supplier communication.
- Changed files/commit: —
