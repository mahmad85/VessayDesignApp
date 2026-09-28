# TASK-022: Multi-garment cart

Status: ready (specified 2026-09-28; depends on TASK-017 and TASK-021)

Implementation packages: WP-37 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019 (the user selected a multi-garment cart); CAT-004.
- Implementation authorisation/source: D-019.
- Requirement IDs and canonical files: CRT-001 to CRT-004 in ORDERS-FULFILLMENT.md; CAT-004; UX-004; UX-017; S-02 and S-08 in ADMIN-SCREENS §4.
- Acceptance scenario IDs: AC-01, AC-38.
- User-visible outcome: a customer builds a suit and two shirts in one draft, switches between them without mixing choices, sets quantities, removes a garment with confirmation, completes one measurement profile covering all garments, and reviews every garment with cart totals.
- In-scope surfaces/modules: the cart switcher, add-garment dialog (S-01 reused), quantity stepper, per-garment review sections, measurement union messaging, chat targeting of the active garment.
- Dependencies and blocking questions: Q-028 (several people in one cart is out of scope).
- Explicit non-goals: several measurement profiles, gifting, saved-for-later.
- Data/API/asset contracts: the `add_garment`, `remove_garment`, `select_garment` and `set_quantity` commands (already in the engine from TASK-016).
- Loading/error/empty/recovery behaviour: removing the last garment → start screen; 10-garment limit message; measurement fields added when a new product needs them.
- Authorisation and privacy requirements: unchanged.
- Migration/compatibility implications: none.
- Test fixtures (synthetic or authorised): synthetic drafts.
- Verification plan: engine tests (switching isolation, union of required measurements, removal confirmation); e2e flow at 1440 and 390; keyboard pass of the switcher.
- Actual verification evidence: not started.
- Deviations and decision references: D-019.
- Remaining limitations: —
- Changed files/commit: —
