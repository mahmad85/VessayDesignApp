# Requirement traceability

Status: generated draft map v0.2, 2026-09-26. Canonical meaning remains in the linked owner file. User-confirmed scope is recorded in DECISIONS.md; detailed requirements remain draft. See the foundation implementation overlay below for executed evidence. The original row map remains the full-product target, not a claim that every requirement is complete.

93 requirements map to 33 proposed acceptance scenarios in [ACCEPTANCE.md](ACCEPTANCE.md). Mapping indicates planned coverage, not evidence of execution. Add task, commit, test identifiers and actual evidence during implementation.

| Requirement | Canonical owner | Acceptance scenarios | Status | Evidence |
| --- | --- | --- | --- | --- |
| AI-001 | [AI-ORCHESTRATION.md](../architecture/AI-ORCHESTRATION.md) | AC-04, AC-05, AC-06, AC-16 | Target; see foundation overlay | Pending full acceptance |
| AI-002 | [AI-ORCHESTRATION.md](../architecture/AI-ORCHESTRATION.md) | AC-03, AC-05, AC-18 | Target; see foundation overlay | Pending full acceptance |
| AI-003 | [AI-ORCHESTRATION.md](../architecture/AI-ORCHESTRATION.md) | AC-06, AC-07 | Target; see foundation overlay | Pending full acceptance |
| AI-004 | [AI-ORCHESTRATION.md](../architecture/AI-ORCHESTRATION.md) | AC-04 | Target; see foundation overlay | Pending full acceptance |
| AI-005 | [AI-ORCHESTRATION.md](../architecture/AI-ORCHESTRATION.md) | AC-05, AC-18 | Target; see foundation overlay | Pending full acceptance |
| AI-006 | [AI-ORCHESTRATION.md](../architecture/AI-ORCHESTRATION.md) | AC-04, AC-05, AC-23 | Target; see foundation overlay | Pending full acceptance |
| AUTH-001 | [BACKEND-AUTH-DECISION.md](../architecture/BACKEND-AUTH-DECISION.md) | AC-30, AC-31 | Target; see foundation overlay | Pending full acceptance |
| AUTH-002 | [BACKEND-AUTH-DECISION.md](../architecture/BACKEND-AUTH-DECISION.md) | AC-30 | Target; see foundation overlay | Pending full acceptance |
| AUTH-003 | [BACKEND-AUTH-DECISION.md](../architecture/BACKEND-AUTH-DECISION.md) | AC-31 | Target; see foundation overlay | Pending full acceptance |
| AUTH-004 | [BACKEND-AUTH-DECISION.md](../architecture/BACKEND-AUTH-DECISION.md) | AC-31 | Target; see foundation overlay | Pending full acceptance |
| AUTH-005 | [BACKEND-AUTH-DECISION.md](../architecture/BACKEND-AUTH-DECISION.md) | AC-22, AC-30, AC-31 | Target; see foundation overlay | Pending full acceptance |
| CAT-001 | [CATALOG.md](../domain/CATALOG.md) | AC-04, AC-07 | Target; see foundation overlay | Pending full acceptance |
| CAT-002 | [CATALOG.md](../domain/CATALOG.md) | AC-02, AC-07, AC-17 | Target; see foundation overlay | Pending full acceptance |
| CAT-003 | [CATALOG.md](../domain/CATALOG.md) | AC-19 | Target; see foundation overlay | Pending full acceptance |
| CAT-004 | [CATALOG.md](../domain/CATALOG.md) | AC-01, AC-02 | Target; see foundation overlay | Pending full acceptance |
| CAT-005 | [CATALOG.md](../domain/CATALOG.md) | AC-05, AC-15 | Target; see foundation overlay | Pending full acceptance |
| CAT-006 | [CATALOG.md](../domain/CATALOG.md) | AC-07, AC-17 | Target; see foundation overlay | Pending full acceptance |
| FR-001 | [PRD.md](../product/PRD.md) | AC-01 | Target; see foundation overlay | Pending full acceptance |
| FR-002 | [PRD.md](../product/PRD.md) | AC-02, AC-03 | Target; see foundation overlay | Pending full acceptance |
| FR-003 | [PRD.md](../product/PRD.md) | AC-05, AC-07 | Target; see foundation overlay | Pending full acceptance |
| FR-004 | [PRD.md](../product/PRD.md) | AC-04 | Target; see foundation overlay | Pending full acceptance |
| FR-005 | [PRD.md](../product/PRD.md) | AC-06 | Target; see foundation overlay | Pending full acceptance |
| FR-006 | [PRD.md](../product/PRD.md) | AC-06 | Target; see foundation overlay | Pending full acceptance |
| FR-007 | [PRD.md](../product/PRD.md) | AC-09 | Target; see foundation overlay | Pending full acceptance |
| FR-008 | [PRD.md](../product/PRD.md) | AC-12 | Target; see foundation overlay | Pending full acceptance |
| FR-009 | [PRD.md](../product/PRD.md) | AC-14, AC-15 | Target; see foundation overlay | Pending full acceptance |
| FR-010 | [PRD.md](../product/PRD.md) | AC-16, AC-17 | Target; see foundation overlay | Pending full acceptance |
| FR-011 | [PRD.md](../product/PRD.md) | AC-18, AC-19 | Target; see foundation overlay | Pending full acceptance |
| FR-012 | [PRD.md](../product/PRD.md) | AC-20 | Target; see foundation overlay | Pending full acceptance |
| INT-001 | [3DLOOK.md](../integrations/3DLOOK.md) | AC-09, AC-10 | Implemented (public widget path); locally verified only | D-017; free-capture path connected, paid-scan adapter still not implemented (no vendor authorization capability) |
| INT-002 | [3DLOOK.md](../integrations/3DLOOK.md) | AC-09, AC-11 | Implemented (fails closed); locally verified only | D-017; paid single-use scan stays 503 until 3DLOOK supplies single-use authorization — no vendor sandbox available |
| INT-003 | [3DLOOK.md](../integrations/3DLOOK.md) | AC-09, AC-10, AC-20 | Implemented (public widget path); locally verified only | D-017; guided capture is the vendor's own widget, not a substitute camera frame |
| INT-004 | [3DLOOK.md](../integrations/3DLOOK.md) | AC-09, AC-12, AC-24 | Implemented; locally verified only | D-017; raw provider dimensions preserved in measurement_source_snapshots, separate from mapped/edited values |
| INT-005 | [3DLOOK.md](../integrations/3DLOOK.md) | AC-13, AC-14 | Target; see foundation overlay | Pending full acceptance — no body-model export in the connected widget path |
| MEAS-001 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-12, AC-24 | Target; see foundation overlay | Pending full acceptance |
| MEAS-002 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-12 | Target; see foundation overlay | Pending full acceptance |
| MEAS-003 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-12, AC-17 | Target; see foundation overlay | Pending full acceptance |
| MEAS-004 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-11, AC-12 | Target; see foundation overlay | Pending full acceptance |
| MEAS-005 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-09, AC-12, AC-24 | Target; see foundation overlay | Pending full acceptance |
| MEAS-006 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-13, AC-20 | Target; see foundation overlay | Pending full acceptance |
| OPS-001 | [SECURITY-RELEASE.md](../operations/SECURITY-RELEASE.md) | AC-22 | Target; see foundation overlay | Pending full acceptance |
| OPS-002 | [SECURITY-RELEASE.md](../operations/SECURITY-RELEASE.md) | AC-22 | Target; see foundation overlay | Pending full acceptance |
| OPS-003 | [SECURITY-RELEASE.md](../operations/SECURITY-RELEASE.md) | AC-10, AC-11, AC-21 | Target; see foundation overlay | Pending full acceptance |
| OPS-004 | [SECURITY-RELEASE.md](../operations/SECURITY-RELEASE.md) | AC-22, AC-23, AC-24 | Target; see foundation overlay | Pending full acceptance |
| OPS-005 | [SECURITY-RELEASE.md](../operations/SECURITY-RELEASE.md) | AC-09, AC-18, AC-22, AC-24 | Target; see foundation overlay | Pending full acceptance |
| ORD-001 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-16, AC-17 | Target; see foundation overlay | Pending full acceptance |
| ORD-002 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-16 | Target; see foundation overlay | Pending full acceptance |
| ORD-003 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-16, AC-26, AC-28, AC-29 | Target; see foundation overlay | Pending full acceptance |
| ORD-004 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-17 | Target; see foundation overlay | Pending full acceptance |
| ORD-005 | [MEASUREMENTS-ORDERS.md](../domain/MEASUREMENTS-ORDERS.md) | AC-17 | Target; see foundation overlay | Pending full acceptance |
| PAY-001 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-27 | Target; see foundation overlay | Pending full acceptance |
| PAY-002 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-27, AC-28 | Target; see foundation overlay | Pending full acceptance |
| PAY-003 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-28 | Target; see foundation overlay | Pending full acceptance |
| PAY-004 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-28, AC-29 | Target; see foundation overlay | Pending full acceptance |
| PAY-005 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-29 | Target; see foundation overlay | Pending full acceptance |
| PAY-006 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-26, AC-33 | Target; see foundation overlay | Pending full acceptance |
| REV-001 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-25, AC-27 | Target; see foundation overlay | Pending full acceptance |
| REV-002 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-25, AC-32 | Target; see foundation overlay | Pending full acceptance |
| REV-003 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-25 | Target; see foundation overlay | Pending full acceptance |
| REV-004 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-25, AC-32 | Target; see foundation overlay | Pending full acceptance |
| REV-005 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-26 | Target; see foundation overlay | Pending full acceptance |
| REV-006 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-26, AC-32 | Target; see foundation overlay | Pending full acceptance |
| REV-007 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-26, AC-29 | Target; see foundation overlay | Pending full acceptance |
| REV-008 | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-32 | Target; see foundation overlay | Pending full acceptance |
| SEC-001 | [SECURITY-RELEASE.md](../operations/SECURITY-RELEASE.md) | AC-18 | Target; see foundation overlay | Pending full acceptance |
| SEC-002 | [SECURITY-RELEASE.md](../operations/SECURITY-RELEASE.md) | AC-18, AC-22 | Target; see foundation overlay | Pending full acceptance |
| SEC-003 | [SECURITY-RELEASE.md](../operations/SECURITY-RELEASE.md) | AC-20, AC-22 | Target; see foundation overlay | Pending full acceptance |
| SEC-004 | [SECURITY-RELEASE.md](../operations/SECURITY-RELEASE.md) | AC-18, AC-20, AC-22 | Target; see foundation overlay | Pending full acceptance |
| SEC-005 | [SECURITY-RELEASE.md](../operations/SECURITY-RELEASE.md) | AC-11, AC-16, AC-18, AC-21 | Target; see foundation overlay | Pending full acceptance |
| UX-001 | [FOUNDATIONS.md](../ux/FOUNDATIONS.md) | AC-01, AC-08 | Target; see foundation overlay | Pending full acceptance |
| UX-002 | [FOUNDATIONS.md](../ux/FOUNDATIONS.md) | AC-23 | Target; see foundation overlay | Pending full acceptance |
| UX-003 | [FOUNDATIONS.md](../ux/FOUNDATIONS.md) | AC-08 | Target; see foundation overlay | Pending full acceptance |
| UX-004 | [SCREENS.md](../ux/SCREENS.md) | AC-07 | Target; see foundation overlay | Pending full acceptance |
| UX-005 | [SCREENS.md](../ux/SCREENS.md) | AC-02, AC-06 | Target; see foundation overlay | Pending full acceptance |
| UX-006 | [SCREENS.md](../ux/SCREENS.md) | AC-09, AC-10 | Target; see foundation overlay | Pending full acceptance |
| UX-007 | [SCREENS.md](../ux/SCREENS.md) | AC-08, AC-12 | Target; see foundation overlay | Pending full acceptance |
| UX-008 | [SCREENS.md](../ux/SCREENS.md) | AC-12 | Target; see foundation overlay | Pending full acceptance |
| UX-009 | [SCREENS.md](../ux/SCREENS.md) | AC-14, AC-17 | Target; see foundation overlay | Pending full acceptance |
| UX-010 | [SCREENS.md](../ux/SCREENS.md) | AC-15 | Target; see foundation overlay | Pending full acceptance |
| UX-011 | [SCREENS.md](../ux/SCREENS.md) | AC-25, AC-26, AC-27, AC-28 | Target; see foundation overlay | Pending full acceptance |
| UX-012 | [SCREENS.md](../ux/SCREENS.md) | AC-18, AC-19 | Target; see foundation overlay | Pending full acceptance |
| UX-013 | [INTERACTIONS.md](../ux/INTERACTIONS.md) | AC-02 | Target; see foundation overlay | Pending full acceptance |
| UX-014 | [INTERACTIONS.md](../ux/INTERACTIONS.md) | AC-03 | Target; see foundation overlay | Pending full acceptance |
| UX-015 | [INTERACTIONS.md](../ux/INTERACTIONS.md) | AC-04, AC-05 | Target; see foundation overlay | Pending full acceptance |
| UX-016 | [INTERACTIONS.md](../ux/INTERACTIONS.md) | AC-07, AC-12 | Target; see foundation overlay | Pending full acceptance |
| UX-017 | [INTERACTIONS.md](../ux/INTERACTIONS.md) | AC-07, AC-15 | Target; see foundation overlay | Pending full acceptance |
| UX-018 | [INTERACTIONS.md](../ux/INTERACTIONS.md) | AC-01, AC-18 | Target; see foundation overlay | Pending full acceptance |
| VIS-001 | [ASSET-CONTRACT.md](../visualization/ASSET-CONTRACT.md) | AC-02, AC-14 | Target; see foundation overlay | Pending full acceptance |
| VIS-002 | [ASSET-CONTRACT.md](../visualization/ASSET-CONTRACT.md) | AC-14 | Target; see foundation overlay | Pending full acceptance |
| VIS-003 | [ASSET-CONTRACT.md](../visualization/ASSET-CONTRACT.md) | AC-13, AC-20 | Target; see foundation overlay | Pending full acceptance |
| VIS-004 | [ASSET-CONTRACT.md](../visualization/ASSET-CONTRACT.md) | AC-12 | Target; see foundation overlay | Pending full acceptance |
| VIS-005 | [ASSET-CONTRACT.md](../visualization/ASSET-CONTRACT.md) | AC-13, AC-14 | Target; see foundation overlay | Pending full acceptance |
| VIS-006 | [ASSET-CONTRACT.md](../visualization/ASSET-CONTRACT.md) | AC-08, AC-13, AC-14, AC-22 | Target; see foundation overlay | Pending full acceptance |

Architecture decisions are owned by [DECISIONS.md](../product/DECISIONS.md). Dependencies are owned by [OPEN-QUESTIONS.md](../product/OPEN-QUESTIONS.md). Screen IDs S-01 through S-13 are owned by [SCREENS.md](../ux/SCREENS.md).

## Foundation implementation overlay — TASK-001

The full acceptance scenarios combine multiple production features; none is marked fully satisfied by a local reference flow. The following partial coverage is implemented and tested.

| Area | Source | Actual evidence | Remaining acceptance |
| --- | --- | --- | --- |
| Shared configuration, compatibility, stale edits and revisions | modules/configuration, db/repository | configuration.test.ts and repository.test.ts | Real catalog version/price dependencies |
| Chat/direct control synchronization | integrations/assistant, api/chat, design-consultation | Browser design/chat/reload flow | Live LLM eval and streaming, malicious-output fixtures |
| Manual measurements and confirmation | modules/measurements, measurement-panel | Domain validation, unit display and browser measurements | Provider capture, protocol/tolerance validation and edit/retake provenance |
| Reference 3D viewer | visualization/garment-view | Browser canvas, screenshots, controls | Verified GLBs, customer mesh and performance on supported devices |
| Review/payment blockers | modules/review, integrations/checkout | Domain fail-closed tests and browser review/API rejection | Real eligibility, staffing, quotes, payments and reconciliation |
| Identity/ownership | lib/auth, lib/http, db/repository | Browser signup/verification/sign-in/claim/sign-out; API isolation/CSRF | Hosted mail/reset delivery, staff MFA and deletion/retention |
| Responsive/accessibility | UI components and globals.css | Chromium 1440/390/768/320 checks; axe and keyboard focus | Screen readers and representative user/device review |
| Quality/runtime | package scripts, CI, readiness route | Type/lint/test/build; audit at build time | Hosted Replit, PostgreSQL restore and operations |

Detailed evidence and exclusions: [TEST-EVIDENCE.md](../implementation/TEST-EVIDENCE.md).

## Full human reference overlay — TASK-011

| Requirements | Implemented reference coverage | Evidence | Remaining acceptance |
| --- | --- | --- | --- |
| VIS-001, VIS-002 | Versioned local anatomical GLB and authored clothes; existing accepted fabric, fit, lapel, pocket, fastening, collar and cuff choices retained | `human-preview.spec.ts`; suit/shirt/blazer and altered-construction screenshots | Supplier assets, calibrated fabric scale and complete production combination approval |
| VIS-003, VIS-005 | Generic full human reference, independent skin tone, no customer reconstruction or fit claim; styling-only items remain identified in review | Measurement and category screenshots; unchanged review descriptions | Licensed provider export and personalized-body/garment validation |
| VIS-004 | Anatomical measurement paths repositioned to new model | Focused Chest label and measurement screenshots; existing manual-measurement journey | Tailor protocol and verified provider landmark mapping |
| VIS-006, UX-003 | Local loading/error states, per-viewer geometry cleanup, keyboard front/side/back/zoom/reset, full figure at 1440/768/390/320px | Passing browser checks, fallback test and inspected `artifacts/human-preview/` screenshots | Representative hardware/GPU measurements, screen-reader evaluation and production visual sign-off |

Source rights and no-recurring-license requirement: D-013; CC0 attribution and offline preparation in `assets/human-source/README.md`. Full task scope and actual checks: [TASK-011](../delivery/TASK-011.md). These rows record local reference coverage, not complete product acceptance.

## Supplied suit customization overlay — TASK-012

| Requirements | Implemented reference coverage | Evidence | Remaining acceptance |
| --- | --- | --- | --- |
| CAT-001, CAT-002, UX-004 | Versioned Style/Accents seed with menu, jacket/pants/vest category, group, section, option, stable selection key and source value | `configuration.test.ts`; generated 434-option seed and local assets | Supplier-approved product schema, terminology and manufacturing interpretation |
| CAT-003, CAT-005 | Source commercial fields remain unapproved metadata; UI labels reference status and checkout remains blocked | Domain tests and browser reference notice | Approved currency, price, availability, asset rights and catalog publication |
| CAT-006, UX-016, UX-017 | Server validates every submitted selection; choices use existing revisioned commands, persist after reload and mapped legacy controls remain synchronized | `human-preview.spec.ts`; Style/Accents screenshots and reload assertion | Authoritative dependency/compatibility rules and historical production catalog snapshots |

Authorization and boundary: D-014; unresolved rights and production data gates: Q-011, Q-014 and Q-023. Full task scope and actual checks: [TASK-012](../delivery/TASK-012.md).

## Admin catalog, commerce and fulfilment specification — D-019 (2026-09-28)

This section adds 56 requirements (including ORD-012 and REV-009 from D-020) and 13 acceptance scenarios (AC-34 to AC-46). D-020 also revised REV-003 to REV-008, PAY-001, ORD-003, UX-011 and the scenarios AC-25 to AC-27 and AC-32 in their canonical files. The status **Specified** means the canonical contract and a ready task exist. **TASK-015 part locally verified** and **TASK-016 part locally verified** (2026-09-28) mean that task's share of the requirement is implemented and passed its automated tests (and, for customer screens, the Playwright suite) on a local PGlite database; tasks named in the row but not listed as verified are not started, and nothing here is externally verified or released. Each task records its actual evidence here when done.

| Requirement | Canonical owner | Acceptance scenarios | Task | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| CAT-007 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-34, AC-43 | TASK-015, TASK-016, TASK-019 | TASK-015, TASK-016 parts locally verified | Database hierarchy, importer and compile: `import-legacy.test.ts`, `catalog-working-copy.test.ts`. Customer tabs derived from the release (§2.1): `catalog-structure.test.ts`, `design-outline.test.ts`, Playwright studio journeys. Admin editing waits for TASK-019 |
| CAT-008 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-34 | TASK-015, TASK-019 | TASK-015 part locally verified | System lookup types and seed values imported and published: `import-legacy.test.ts`, `release-repository.test.ts`. Admin maintenance waits for TASK-019 |
| CAT-009 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-34, AC-35 | TASK-015, TASK-020, TASK-027 | TASK-015 part locally verified | Material fields stored and compiled; imported fabrics keep weight, composition, band and supplier empty: `import-legacy.test.ts`, `validate-release.test.ts` |
| CAT-010 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-07, AC-34 | TASK-016, TASK-019 | TASK-015, TASK-016 parts locally verified | Condition language, fixed-point visibility and rule checks: `catalog-snapshot.test.ts`, `validate-release.test.ts`. Every command path (direct controls, chat suggestions dry-run, rebase) changes a garment only through `applyGarmentPatch`, with rule impact confirmed by the customer: `catalog-garment.test.ts`, `configuration.test.ts`, `assistant.test.ts`. Rule editing waits for TASK-019 |
| CAT-011 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-34 | TASK-016, TASK-019 | TASK-015, TASK-016 parts locally verified | Per-product settings stored, compiled and validated (imported blazer restrictions): `import-legacy.test.ts`, `catalog-working-copy.test.ts`. Applied at runtime (availability, product defaults, choice restrictions): `catalog-structure.test.ts`, `catalog-garment.test.ts` |
| CAT-012 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-19, AC-34, AC-35 | TASK-015, TASK-021 | TASK-015 part locally verified | Validated, immutable, versioned publish under an advisory lock; history kept (AC-19 publish portion): `release-repository.test.ts` |
| CAT-013 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-07, AC-34 | TASK-016, TASK-021 | TASK-016 part locally verified | Garments pin a release; silent rebase when nothing is lost, otherwise `catalogUpdates`, 409 `catalog_update_required` and a consented `rebase_catalog`; v1 drafts upgraded on read: `catalog-garment.test.ts`, `configuration.test.ts`, `draft-upgrade.test.ts`, `repository.test.ts`, `catalog-routes.test.ts`. Look provenance waits for TASK-021 |
| CAT-014 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-43 | TASK-015, TASK-016, TASK-019 | TASK-015, TASK-016 parts locally verified | Registry derived from renderer code; every imported binding resolves: `visual-registry.test.ts`, `import-legacy.test.ts`. Renderers read render values bound through the registry and contain no catalog selection key; the WP-00b goldens are unchanged on the v2 path (AC-43, local): `golden.test.ts`, `visual-binding.test.ts`. Token editing waits for TASK-019 |
| CAT-015 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-34 | TASK-015, TASK-019 | TASK-015 part locally verified | Loader archives, never deletes; `first_published_version` stamped at publish: `catalog-working-copy.test.ts`, `release-repository.test.ts`. `code_immutable` enforcement waits for TASK-019 |
| CAT-016 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-45 | TASK-015, TASK-019, TASK-026 | TASK-015 part locally verified | Static media rows record type, size, sha256, alt text and rights; missing alt text is a publish warning: `catalog-working-copy.test.ts`, `validate-release.test.ts`. Uploads wait for TASK-019 |
| CAT-017 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-39 | TASK-015, TASK-020, TASK-023 | TASK-015 part locally verified | Imported data and release v1 are `reference_only`: `import-legacy.test.ts`, `release-repository.test.ts`. Production reference-data blocking is implemented and covered by `orders.test.ts` (TASK-023) |
| CAT-018 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-39 | TASK-016, TASK-020, TASK-023 | TASK-015, TASK-016 parts locally verified | Live availability is never overwritten by load or restore: `catalog-working-copy.test.ts`. Runtime overlay cached 60 s; an out-of-stock or discontinued fabric cannot be newly chosen (409 `material_unavailable`) and is shown disabled: `catalog-routes.test.ts`, `catalog-garment.test.ts`. Submission and checkout re-read uncached availability (TASK-023/024; `orders.test.ts`) |
| TPL-001 – TPL-004 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-37 | TASK-021 | Specified | Not started |
| PRC-001 – PRC-005, PRC-007 | [PRICING.md](../domain/PRICING.md) | AC-36 | TASK-017, TASK-020 | TASK-017 part locally verified | Money helpers (TASK-015); the pricing engine with PRICING.md E1 – E7 exactly: `pricing.test.ts`; the live quote in studio responses, open drafts repriced on their next read and the quote-derived review finding: `price-display.test.ts`; the customer price display, “+$X”, “Customising adds $Y” and “Price not yet available”: Playwright `pricing.spec.ts` on SYNTHETIC prices. The admin matrix and simulator wait for TASK-020 |
| PRC-006 | [PRICING.md](../domain/PRICING.md) | AC-39 | TASK-023 | Implemented, locally tested | Persisted quote/expiry and exact-total acceptance; immutable history: `orders.test.ts`; [M5 evidence](../delivery/M5-EVIDENCE.md) |
| CRT-001 – CRT-004 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-01, AC-38 | TASK-016, TASK-022 | Implemented, locally tested | Cart UI, isolation, removal/quantity/union and keyboard browser journey; [M5 evidence](../delivery/M5-EVIDENCE.md) |
| ORD-006 – ORD-012 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-15, AC-16, AC-17, AC-25, AC-26, AC-39, AC-46 | TASK-023 | M5 portions implemented, locally tested | Atomic submission/history, re-submit/cancel, customer DTO/pages, tailor proposal/amendment; WP-38 AI adapter deferred under D-021; [M5 evidence](../delivery/M5-EVIDENCE.md) |
| REV-009 (D-020) | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-39 | TASK-023 | Implemented, locally tested | Explicit two-statement sign-off bound to revision, check and measurements; legal wording remains Q-032; [M5 evidence](../delivery/M5-EVIDENCE.md) |
| PAY-007 – PAY-009 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-27, AC-28, AC-40 | TASK-024 | Implemented, locally tested | Stripe guard/adapter contract, durable attempts, signed fixtures and synthetic browser payment; external sandbox unverified; [M5 evidence](../delivery/M5-EVIDENCE.md) |
| FUL-001 – FUL-006 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-41 | TASK-025 | Implemented, locally tested | Every allowed/denied transition, release guards, reasoned assignment/deadlines, hold/resume/rework/cancel, current-snapshot production sheet and customer-safe tracking; [M6 evidence](../delivery/M6-EVIDENCE.md) |
| SUP-001 – SUP-003 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-44 | TASK-020, TASK-025 | M4 code present; M6 assignment/deactivation portions locally tested | Supplier immutability once referenced by an order, inactive assignment/release guard, history retained after deactivation; independent full M4 acceptance remains open |
| SUP-004 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-44 | TASK-025 | Implemented, locally tested | Assigned-item filters and supplier open/overdue counts, browser views; [M6 evidence](../delivery/M6-EVIDENCE.md) |
| NTF-001 – NTF-002 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-33 | TASK-023, TASK-024, TASK-025 | Outbox/local dispatch and staff retry implemented, locally tested | Transactional shipment/cancellation enqueue, delivery-failure isolation/event, guarded retry UI and maintenance CLI; live delivery remains Q-022; [M5 evidence](../delivery/M5-EVIDENCE.md), [M6 evidence](../delivery/M6-EVIDENCE.md) |
| ADM-001 – ADM-003 | [ADMIN-SCREENS.md](../ux/ADMIN-SCREENS.md) | AC-18, AC-31, AC-42 | TASK-018 | Specified | Not started |
| ADM-004 – ADM-006 | [ADMIN-SCREENS.md](../ux/ADMIN-SCREENS.md) | AC-34, AC-36, AC-42 | TASK-019, TASK-020, TASK-021 | Specified | Not started |

Existing requirements with new implementation paths: FR-011 (admin catalog and order review) → TASK-018 to TASK-025; CAT-004 → TASK-022; CAT-005 → TASK-017 and TASK-023; ORD-001 to ORD-005 → TASK-023 and TASK-025; REV-001 to REV-009 as revised by **D-020** (the automated check and the customer sign-off gate payment; an optional tailor review runs after payment and before release; staffing gated by Q-018) → TASK-023, with the release guard in TASK-025; PAY-001 to PAY-006 → TASK-024 (test mode); UX-012 → TASK-018 and TASK-025; S-10 and S-11 → ADM screens. CAT-005 (the price mechanism; unknown is never zero) is locally verified by TASK-017 with SYNTHETIC prices; real prices remain Q-011/Q-019. TASK-016 (locally verified 2026-09-28) also covers AI-002, AI-003 and AI-005 for the catalog: the assistant context is bounded to the current release, and model changes are dry-run through `applyGarmentPatch` and dropped when invalid (`assistant.test.ts`, stubbed model; no live model evaluation, readiness item R3), plus FR-002, FR-003, UX-004, UX-005, UX-013, VIS-001 and VIS-002 on the release-driven studio (Playwright studio and human-preview journeys at 1440/768/390/320). Technical contracts: [ADMIN-BACKEND.md](../architecture/ADMIN-BACKEND.md) and [API-REFERENCE.md](../architecture/API-REFERENCE.md). Baseline description: [CURRENT-SYSTEM.md](../architecture/CURRENT-SYSTEM.md).

### M5 existing requirement overlay — 2026-09-29

ORD-001–003/005: immutable signed-off snapshots and amendments; REV-001–007/009: deterministic check and optional post-payment customer-owned tailor decision; PAY-001–004/006: verified payment and outbox notifications; ADM-13/14: role/MFA-guarded queue and decision screens. These M5 portions are implemented with local synthetic tests ([M5 evidence](../delivery/M5-EVIDENCE.md)). WP-38's actual OpenAI order-advice adapter and live evaluation are deferred under D-021 until the remaining functionality is complete; the provider-independent privacy/schema/timeout contract is tested. Deferred AI does not block independent non-AI packages. Production release guards and fulfilment export are covered by the subsequent M6 overlay; no live fit, payment, mail or staffing acceptance is implied. Earlier historical implementation overlays do not supersede these scoped updates.

### M6 existing requirement overlay — 2026-09-29

ORD-005/011: production sheet matches current accepted measurements and preserves historical snapshots; customer detail shows only friendly tracking, explicit ETA and customer-visible notes. UX-012 and ADM-01/11/12/16/18: attributed activity, order desk/detail, live counts, supplier items and support lookup with server-side measurement redaction. SEC-001/004/005 and OPS-001/005: permission/MFA/origin contract checks, safe HTML/tracking, scoped upload/webhook review, synthetic end-to-end evidence and dependency audit. Requirements FUL-001–006, SUP-003/004 and NTF-001/002 are implemented with local verification, documented in [M6 evidence](../delivery/M6-EVIDENCE.md). Hosted concurrency, external payment/mail/supplier validation, Q-030 confirmation and production release remain open.

### PR #2 enrollment CI follow-up — 2026-09-29

AUTH-004 and ADM-002 (AC-31, AC-42): the staff enrollment form remains inert until its client submission handler is ready. The delayed-script regression and existing keyboard/TOTP/denial journeys passed locally; OPS-001 repository typecheck, lint, all 316 tests, build and formatting also passed locally. Latest-head CI results are recorded on PR #2. [PR-2-CI.md](../delivery/PR-2-CI.md) records the original failed trace, before/after regression and masked responsive screenshots. Recovery policy, external validation and production release remain open; this scoped fix does not mark those requirements fully accepted.

OPS-001 verification follow-up for AC-41/42: the M6 browser journey now waits for loaded support customer/order content and a non-empty document title before accessibility and privacy checks. The complete journey passed locally (1/1 with 50 captures); no fulfilment rule or acceptance assertion was removed. Evidence and both triggering CI runs are in [PR-2-CI.md](../delivery/PR-2-CI.md).

OPS-001 test-harness follow-up: the staff delayed-hydration regression now intercepts only JavaScript and waits for navigation completion, after a CI screenshot font wait stalled under broad request interception. AUTH-004/ADM-002 assertions, font readiness and timeout remain unchanged; focused staff verification passed 2/2. See the CI evidence record for the passing full push run and the diagnosed parallel PR run.
