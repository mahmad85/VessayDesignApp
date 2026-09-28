# TASK-021: Templates (looks), publish workflow, preview and customer start gallery

Status: ready (specified 2026-09-28; depends on TASK-019 and TASK-020)

Implementation packages: WP-33 – WP-36 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019 (templates are a starting point only).
- Implementation authorisation/source: D-019.
- Requirement IDs and canonical files: TPL-001 to TPL-004, CAT-012, CAT-013 (the customer update banner) and ADM-006 in CATALOG-ADMIN.md and ADMIN-SCREENS.md; ADM-08, ADM-09, ADM-10 and S-01.
- Acceptance scenario IDs: AC-19, AC-34, AC-35, AC-37.
- User-visible outcome: admins create looks, preview the working catalog, review validation and diff, and publish or restore versions. Customers start from a gallery of published looks or from scratch, and see a banner when a catalog update affects their choices.
- In-scope surfaces/modules: template repository and endpoints (API-REFERENCE §3.6); publish endpoints (§3.7); the staff preview (`/api/studio?catalog=working`, owner `preview:user:<id>`, a preview banner in the studio); ADM-08, ADM-09 and ADM-10; the S-01 gallery; `templates/from-preview`.
- Dependencies and blocking questions: Q-023 (rights for any real imagery).
- Explicit non-goals: scheduled publishing, per-market catalogs, template locks (explicitly rejected by the D-019 choice).
- Data/API/asset contracts: API-REFERENCE §3.6–3.7; `templates` in the snapshot (ADMIN-BACKEND §5).
- Loading/error/empty/recovery behaviour: the publish stepper states; the empty gallery falls back to product cards; a stale-release conflict reloads the check.
- Authorisation and privacy requirements: `catalog.publish` to publish or restore; preview only for staff.
- Migration/compatibility implications: none.
- Test fixtures (synthetic or authorised): synthetic looks with synthetic images.
- Verification plan: publish-blocked and warning-acknowledgement tests; diff correctness; restore then publish; an e2e admin flow (create look → preview → publish → customer gallery shows it → customise → price recomputed → archive look → the customer garment is unchanged, TPL-003); screenshots of the gallery at 1440/768/390/320.
- Actual verification evidence: not started.
- Deviations and decision references: D-019; the “As shown” price wording (CATALOG-ADMIN TPL-004).
- Remaining limitations: —
- Changed files/commit: —
