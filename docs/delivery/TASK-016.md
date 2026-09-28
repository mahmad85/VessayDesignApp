# TASK-016: Customer runtime on catalog releases (engine v2, visual binding, grounded assistant)

Status: ready (specified 2026-09-28; depends on TASK-015)

Implementation packages: WP-00b, WP-09 – WP-16 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019; D-015 and D-016 behaviour must be preserved.
- Implementation authorisation/source: D-019.
- Requirement IDs and canonical files: CAT-010, CAT-011, CAT-013, CAT-014, CAT-018 (overlay) in CATALOG-ADMIN.md; CRT-001 (data model only) in ORDERS-FULFILLMENT.md; FR-002, FR-003, UX-004, UX-005, UX-013, UX-014, AI-002, AI-003, AI-005, VIS-001, VIS-002; draft v2 in ADMIN-BACKEND §7; assistant grounding in §11.
- Acceptance scenario IDs: AC-02, AC-03, AC-05, AC-06, AC-07, AC-43; the runtime portion of AC-34.
- User-visible outcome: the studio behaves as today, but every option comes from the published release. A new visitor first sees a minimal **Choose a garment** start screen (Suit, Shirt, Blazer → Start designing). Templates are added in TASK-021.
- In-scope surfaces/modules: `modules/catalog/{structure,garment}.ts`; `modules/configuration/{types,upgrade,engine,design-outline}.ts`; `modules/review/review.ts` (v2 shape); `modules/measurements/definitions.ts` (`requiredDefinitionsForProducts`); `db/repository.ts` (upgrade on read of `drafts`, `actions` and `revisions`; v2 commands; preview owner hook); `db/availability.ts`; `visualization/binding.ts` and refactors of `sketch-spec.ts`, `focus-regions.ts`, `coverage.ts`, `tailored-human.tsx` and `garments/*` to read render values; `integrations/assistant.ts`; components (`studio`, `design-navigator`, `selection-tags`, `design-consultation`, `review-panel`, `use-studio`) consuming `CustomerCatalog` from `/api/catalog/v/{version}`; new routes `/api/catalog/current`, `/api/catalog/v/[version]` and `/api/media/[id]` (static driver).
- Dependencies and blocking questions: TASK-015. Q-026 (tailor review of the preserved `relaxed` suit fit).
- Explicit non-goals: prices (TASK-017), multi-garment UI (TASK-022; the engine supports several garments but the UI shows one), admin UI, templates.
- Data/API/asset contracts: `CommandV2`, `DraftV2`, `Impact` and the studio response per ADMIN-BACKEND §7 and API-REFERENCE §2.2–2.3.
- Loading/error/empty/recovery behaviour: catalog fetch failure → the existing recoverable error state, with the saved draft untouched. `catalogUpdates` shows an impact dialog. 409 `impact_confirmation_required` shows the impact and a Confirm button that re-sends with `confirmImpact`.
- Authorisation and privacy requirements: unchanged ownership. The assistant context excludes supplier fields and measurements (ADMIN-BACKEND §11).
- Migration/compatibility implications: no SQL migration. Draft JSON is upgraded lazily and deterministically (§7.2). Existing browser and unit tests are **ported, not weakened**: every existing assertion keeps an equivalent v2 assertion.
- Test fixtures (synthetic or authorised): the synthetic snapshot fixture; v1 draft fixtures for each product, built from today’s `createDraft()` plus edited variants.
- Verification plan: see the build steps; Playwright studio and human-preview specs at 1440/768/390/320; keyboard pass; axe.
- Actual verification evidence: not started.
- Deviations and decision references: D-019. The start screen is new behaviour required by the empty-cart model.
- Remaining limitations: prices still unavailable; one garment visible at a time.
- Changed files/commit: —

## Build steps

1. **Record goldens first** (before touching renderers): a script under `tests/golden/` computes `sketchSpec(design)` and the `shownIn3D`/`regionForLeaf` results for a synthetic matrix (defaults and each value of every seed section, for suit; the legacy options for shirt and blazer). Commit the JSON goldens.
2. Implement `structure.ts` (defaults, the effective-selection fixed point, visible tabs per CATALOG-ADMIN §2.1) and `garment.ts` (`applyGarmentPatch`, `validateGarment`, `rebaseGarment`, and impact computation per §5.3 and §7.8), with unit tests for every rule path.
3. Implement `upgrade.ts` per ADMIN-BACKEND §7.2, with table-driven tests covering each row.
4. Rewrite `engine.ts` for `CommandV2`, keeping today’s error codes where the semantics are unchanged (`category_confirmation_required`, `incompatible_fabric`, `design_incomplete`, `unknown_measurement`, `missing_measurements`). Measurements use the union of required fields across garments.
5. Update `repository.ts`: upgrade on every read path; `getDraft` creates v2 with no garments; the chat replay path is unchanged.
6. Add `binding.ts` and refactor the renderers to read `renderValues`. Rewrite `design-outline.ts` to read the snapshot (same `OutlineBranch`/`OutlineLeaf` shape; leaf id = group code). Run the goldens: they must be identical.
7. Add the catalog and media routes, and the live availability overlay in studio responses.
8. Update the UI components to use `CustomerCatalog`, the minimal start screen, the impact dialogs and a “Not illustrated” marker.
9. Update the assistant (schema, context and dry-run validation) and guided mode (lookup-based matching). Add AI-006 fixtures for unknown codes and for instruction text inside catalog descriptions.
10. Port the tests: `configuration.test.ts`, `design-outline.test.ts`, `repository.test.ts`, `garments.test.ts`, and the e2e specs.
