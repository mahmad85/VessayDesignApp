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

This section adds 56 requirements (including ORD-012 and REV-009 from D-020) and 13 acceptance scenarios (AC-34 to AC-46). D-020 also revised REV-003 to REV-008, PAY-001, ORD-003, UX-011 and the scenarios AC-25 to AC-27 and AC-32 in their canonical files. The status **Specified** means the canonical contract and a ready task exist. Nothing below is implemented or verified yet. Each task records its actual evidence here when done.

| Requirement | Canonical owner | Acceptance scenarios | Task | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| CAT-007 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-34, AC-43 | TASK-015, TASK-016, TASK-019 | Specified | Not started |
| CAT-008 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-34 | TASK-015, TASK-019 | Specified | Not started |
| CAT-009 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-34, AC-35 | TASK-015, TASK-020, TASK-027 | Specified | Not started |
| CAT-010 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-07, AC-34 | TASK-016, TASK-019 | Specified | Not started |
| CAT-011 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-34 | TASK-016, TASK-019 | Specified | Not started |
| CAT-012 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-19, AC-34, AC-35 | TASK-015, TASK-021 | Specified | Not started |
| CAT-013 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-07, AC-34 | TASK-016, TASK-021 | Specified | Not started |
| CAT-014 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-43 | TASK-015, TASK-016, TASK-019 | Specified | Not started |
| CAT-015 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-34 | TASK-015, TASK-019 | Specified | Not started |
| CAT-016 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-45 | TASK-015, TASK-019, TASK-026 | Specified | Not started |
| CAT-017 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-39 | TASK-015, TASK-020, TASK-023 | Specified | Not started |
| CAT-018 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-39 | TASK-016, TASK-020, TASK-023 | Specified | Not started |
| TPL-001 – TPL-004 | [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md) | AC-37 | TASK-021 | Specified | Not started |
| PRC-001 – PRC-005, PRC-007 | [PRICING.md](../domain/PRICING.md) | AC-36 | TASK-017, TASK-020 | Specified | Not started |
| PRC-006 | [PRICING.md](../domain/PRICING.md) | AC-39 | TASK-023 | Specified | Not started |
| CRT-001 – CRT-004 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-01, AC-38 | TASK-016, TASK-022 | Specified | Not started |
| ORD-006 – ORD-012 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-15, AC-16, AC-17, AC-25, AC-26, AC-39, AC-46 | TASK-023 | Specified | Not started |
| REV-009 (D-020) | [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) | AC-39 | TASK-023 | Specified | Not started |
| PAY-007 – PAY-009 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-27, AC-28, AC-40 | TASK-024 | Specified | Not started |
| FUL-001 – FUL-006 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-41 | TASK-025 | Specified | Not started |
| SUP-001 – SUP-004 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-44 | TASK-020, TASK-025 | Specified | Not started |
| NTF-001 – NTF-002 | [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md) | AC-33 | TASK-023, TASK-024 | Specified | Not started |
| ADM-001 – ADM-003 | [ADMIN-SCREENS.md](../ux/ADMIN-SCREENS.md) | AC-18, AC-31, AC-42 | TASK-018 | Specified | Not started |
| ADM-004 – ADM-006 | [ADMIN-SCREENS.md](../ux/ADMIN-SCREENS.md) | AC-34, AC-36, AC-42 | TASK-019, TASK-020, TASK-021 | Specified | Not started |

Existing requirements with new implementation paths: FR-011 (admin catalog and order review) → TASK-018 to TASK-025; CAT-004 → TASK-022; CAT-005 → TASK-017 and TASK-023; ORD-001 to ORD-005 → TASK-023 and TASK-025; REV-001 to REV-009 as revised by **D-020** (the automated check and the customer sign-off gate payment; an optional tailor review runs after payment and before release; staffing gated by Q-018) → TASK-023, with the release guard in TASK-025; PAY-001 to PAY-006 → TASK-024 (test mode); UX-012 → TASK-018 and TASK-025; S-10 and S-11 → ADM screens. Technical contracts: [ADMIN-BACKEND.md](../architecture/ADMIN-BACKEND.md) and [API-REFERENCE.md](../architecture/API-REFERENCE.md). Baseline description: [CURRENT-SYSTEM.md](../architecture/CURRENT-SYSTEM.md).
