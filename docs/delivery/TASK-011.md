# TASK-011: Full human reference for tailoring preview

Status: verified locally; not externally approved or released

- Approved baseline: product v0.2, authorized foundation v0.1 overlay (D-012).
- Implementation authorization/source: user requested a human figure from head to toe in place of the robotic torso on 2026-09-27, then required no ongoing license cost. D-013 records that direction.
- Requirement IDs and canonical files: VIS-001–006 in `docs/visualization/ASSET-CONTRACT.md`; UX-003 in `docs/ux/FOUNDATIONS.md`. This task improves their reference-viewer coverage; it does not complete the production asset or provider requirements.
- Acceptance scenario IDs: local reference portions of AC-02, AC-08, AC-12, AC-13 and AC-14.
- User-visible outcome: anatomical full human mesh with sculpted face, ears, hair, individual fingers and toes; tailored suit/shirt/blazer surfaces, continuous sleeves, shaped trousers and shoes; working camera and accepted design controls.
- In-scope surfaces/modules: browser 3D renderer, local asset preparation, bundled model and license, small-screen camera clearance, aligned measurement paths and visual evidence.
- Dependencies and blocking questions: no paid asset service required; existing Q-008/Q-014 still gate customer body exports and production garment/fit acceptance.
- Explicit non-goals: photographic likeness, personal body reconstruction, animated dressing, cloth physics, vendor integration, paid ordering, production deployment.
- Data/API/asset contracts: pinned CC0 MakeHuman source, local GLB v1 and manifest, original garment geometry; existing accepted Design and actual reference fabric IDs. No API or database contract changes.
- Loading/error/empty/recovery behavior: model loading message; asset/WebGL errors show an honest unavailable state and preserve direct controls. Reload can retry an asset failure. No fake static human image replaces the 3D model.
- Authorization and privacy requirements: all source assets are public, generic references; no customer photo, measurement or scan is sent to an asset service. Skin tone remains independent of body shape. Development measurements remain synthetic.
- Migration/compatibility implications: none; no new dependencies. Existing Three.js/R3F/Drei and Next.js are retained. Cached source geometry is cloned per viewer and owned GPU resources are disposed independently.
- Test fixtures (synthetic or authorized): existing synthetic catalog and browser guest drafts; CC0 generic reference mesh.
- Verification plan: types, lint, domain/repository tests, production build, full browser suite, interactive front/side/back/zoom/reset, construction and category changes, unavailable asset, desktop/tablet/mobile/320px inspection.
- Actual verification evidence: all eight browser scenarios passed across the combined run and one targeted rerun; 15 domain/repository tests passed; TypeScript, ESLint, changed-code formatting and the optimized production build passed. The combined run had seven passes and one screenshot-file write error at the pre-existing `artifacts/01-design-desktop.png`; adding a configurable screenshot directory preserved that file, and the unchanged journey assertions passed with fresh evidence under `artifacts/human-preview/journey/`. Front/side/back, shirt/blazer, measurement and all four viewport screenshots were visually inspected. No uncaught page errors occurred in the successful preview test.
- Deviations and decision references: D-013; local CC0 geometry replaces the primitive mannequin within the existing renderer. No framework or external integration change. Free asset rights do not imply production fit approval.
- Remaining limitations: generic adult body and reference cloth, no physical-fit certification or photographic customer likeness; no lower-powered hardware performance certification, hosted deployment or external approval. This workspace has no Git metadata, so no commit/diff can be reported.
- Changed files/commit: `src/visualization/garment-view.tsx`, `src/visualization/tailored-human.tsx`, `src/app/globals.css`, `scripts/build-human-model.mjs`, `assets/human-source/*`, `public/models/*`, `tests/e2e/human-preview.spec.ts`, screenshot-directory support in `tests/e2e/studio.spec.ts`, README and implementation/traceability/decision records. No commit.

## Visual evidence

Screenshots in `artifacts/human-preview/`: suit desktop/front/side/back/detail, altered check/relaxed/peak/patch/one-button configuration, shirt and blazer front/side, measurement reference, and 768×1024, 390×844 and 320×740 layouts. These are actual local browser renders. The desktop test viewport is 1440×900. Inspect these alongside the passing interaction checks; screenshots alone are not proof of interactive 3D.
