# TASK-019: Admin catalog structure, rules, lists and media

Status: in progress (WP-22 implemented 2026-09-29; WP-23–28 not started)

Implementation packages: WP-22 – WP-28 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019.
- Implementation authorisation/source: D-019 (“Admin user should be able to define everything in an intuitive way”).
- Requirement IDs and canonical files: CAT-007, CAT-008, CAT-010, CAT-011, CAT-014 (binding fields), CAT-015 and CAT-016 in CATALOG-ADMIN.md; ADM-004 and ADM-005; ADM-02, ADM-03, ADM-06 and ADM-19 in ADMIN-SCREENS.md.
- Acceptance scenario IDs: AC-34 (editing), AC-45.
- User-visible outcome: a catalog manager can add, edit, reorder, duplicate and archive products, parts, option groups, options and choices, including images, surcharges, product-specific overrides, visibility conditions, compatibility rules and lookup lists. None of it reaches customers until publishing (TASK-021).
- In-scope surfaces/modules: `db/catalog-admin-repository.ts` (CRUD with `row_version`, audit, the code-immutability and delete guards); `integrations/storage/{index,local,static}.ts`; the media upload pipeline; endpoints API-REFERENCE §3.2 and §3.4; admin pages ADM-02, ADM-03, ADM-06 and ADM-19; the condition builder component; per-node validation badges (from `validate-release` run on the working compile, cached by checksum).
- Dependencies and blocking questions: Q-024 for production storage (use the local driver until then).
- Explicit non-goals: fabrics, pricing matrix and suppliers (TASK-020); templates and publish (TASK-021); CSV import (TASK-027).
- Data/API/asset contracts: API-REFERENCE §3.2 and §3.4. DTOs mirror ADMIN-BACKEND §4.1.
- Loading/error/empty/recovery behaviour: per-panel save; `stale_row_version` reconciliation UI; blank states per ADMIN-SCREENS.
- Authorisation and privacy requirements: `catalog.read`/`catalog.write`; origin checks; uploads validated per ADMIN-BACKEND §9.
- Migration/compatibility implications: none (uses 0003).
- Test fixtures (synthetic or authorised): synthetic images generated in tests (a tiny PNG, JPEG and WebP, a spoofed extension, an oversized file, an SVG).
- Verification plan: repository tests for every mutation (row version, audit row, code immutability after publish, delete versus archive); media validation tests; e2e: add a group with two choices and a condition, preview badges, keyboard-only reorder; screenshots at 1440 and 768.
- Actual verification evidence: WP-22 local automated checks are recorded in [WP-22](WP-22.md). Media and lookup handlers are implemented; the structure repository and admin editor screens remain WP-23–28. This does not complete TASK-019 or M4.
- Deviations and decision references: D-019.
- Remaining limitations: production storage (TASK-026).
- Changed files/commit: `codex/m3-m4-admin-catalog`; storage adapters, media/lookup repositories and routes, shared admin mutation helpers, `tests/media-lookup.test.ts` and synthetic raster fixtures. No new runtime dependency.
