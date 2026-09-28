# TASK-020: Fabrics, suppliers, pricing admin and commerce settings

Status: ready (specified 2026-09-28; depends on TASK-017 and TASK-019)

Implementation packages: WP-29 – WP-32 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019 (bands plus override; basic supplier management).
- Implementation authorisation/source: D-019.
- Requirement IDs and canonical files: CAT-009 and CAT-018 (live availability editing); PRC-001 to PRC-003 (admin entry and effective display); SUP-001 to SUP-003 in ORDERS-FULFILLMENT.md; ADM-04, ADM-05, ADM-07, ADM-15, ADM-16 (the details and fabrics tabs) and ADM-17 (Commerce) in ADMIN-SCREENS.md.
- Acceptance scenario IDs: AC-35, AC-36 (admin simulator parity), AC-44.
- User-visible outcome: a catalog manager maintains fabrics with full expert metadata, bands and overrides; an owner sets the commerce settings; an order or catalog manager maintains suppliers with a primary and secondary contact. The price simulator matches the studio exactly.
- In-scope surfaces/modules: material, supplier, pricing and settings repositories and services; endpoints API-REFERENCE §3.1 (settings), §3.3 and §3.5; pages ADM-04, ADM-05, ADM-07, ADM-15, ADM-16 and ADM-17 Commerce; the `clear-reference-only` flow (CAT-017).
- Dependencies and blocking questions: Q-019 (currency and shipping defaults are placeholders); Q-027 (supplier contracts); Q-011 (real fabric data).
- Explicit non-goals: supplier portals, CSV import (TASK-027), assigning orders to suppliers (TASK-025).
- Data/API/asset contracts: API-REFERENCE §3.1, §3.3 and §3.5.
- Loading/error/empty/recovery behaviour: the composition total indicator; “Not priced” cells; the live-availability confirmation.
- Authorisation and privacy requirements: supplier contacts are visible only with `suppliers.read`, and are never in logs, audit values, customer projections or assistant context.
- Migration/compatibility implications: none (0003).
- Test fixtures (synthetic or authorised): synthetic suppliers (for example “SYNTHETIC Mill Ltd”, example.com addresses), synthetic fabrics and prices.
- Verification plan: validation tests (composition sum, lookup codes, hex, ranges); the simulator equals `quoteGarment` for E1–E7; an availability change is visible in the studio within the cache window and immediately at submit; e2e fabric creation with media; keyboard pass of ADM-05.
- Actual verification evidence: not started.
- Deviations and decision references: D-019.
- Remaining limitations: real supplier and fabric data entry is an operations task after Q-011.
- Changed files/commit: —
