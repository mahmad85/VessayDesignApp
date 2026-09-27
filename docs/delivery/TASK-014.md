# TASK-014: Generated 3D garments for a more realistic preview

Status: implemented and locally verified; not externally approved or released

- Approved baseline: product v0.2 with D-012, D-013, D-015; direction D-016.
- Implementation authorization/source: user decisions of 2026-09-27 (no artist, "good enough" visualizer, main details in 3D and the rest in 2D, mostly mobile).
- Requirement IDs and canonical files: VIS-001, VIS-002, VIS-005 and VIS-006 in `docs/visualization/ASSET-CONTRACT.md`; UX-003 for unchanged camera controls.
- User-visible outcome: the 3D suit, blazer, shirt, vest and trousers follow the reference body with continuous sleeves and no shoulder or cuff gaps. The jacket hangs straight from the chest and shoulder blades instead of following the waist and seat. Lapels, collars and pockets have thickness, rolled edges and stitching. Buttons are domed and instanced. Trousers fall straight from the seat with a pressed crease. Shoes have uppers and soles. Lighting uses local soft boxes and the cloth has a woven normal map and sheen. When a 2D-only detail is being edited in 3D, the preview says so and offers a one-tap switch to 2D.
- Main 3D choices: garment, fabric, fit, jacket style (single-breasted 1/2/3, double-breasted 2/4/6, Mandarin), lapel type and width, hip, ticket and breast pockets, sleeve buttons, vent, trouser fit, length, break and turn-ups, vest on/off with button style and edge, shirt collar and cuffs, button colour and shoe colour. Everything else stays in 2D.
- In-scope surfaces/modules: `scripts/lib/human-body.mjs` (shared posed body; the existing model build is byte-identical), `scripts/build-garment-profiles.mjs` → `src/visualization/body-profiles.json`, `src/visualization/garments/*` (profiles, geometry helpers, garment builders, materials, 3D coverage), `src/visualization/outfit.tsx`, `tailored-human.tsx` and `garment-view.tsx` (lighting), studio hint, tests.
- Dependencies and blocking questions: none new. Q-008 and Q-014 remain for personal bodies and production assets.
- Explicit non-goals: pattern drafting, cloth simulation, personalised body shape, measurement-mode changes, new libraries, downloaded HDRIs.
- Data/API/asset contracts: no API or database change. The profile table is generated offline from the pinned CC0 source (about 66 KB) and bundled with the 3D code. The GLB is unchanged; its old `Trousers` mesh is no longer drawn and can be dropped in a later model version.
- Loading/error/empty/recovery behavior: unchanged model loading and failure fallback. Garments are rebuilt only when a shape-affecting choice changes.
- Authorization and privacy requirements: unchanged; no customer data.
- Migration/compatibility implications: none.
- Test fixtures (synthetic or authorized): synthetic drafts only.
- Verification plan: typecheck, lint, unit tests for finite geometry, construction per option, geometry change for each main choice, layer clearance and 3D coverage; full Playwright suite; visual inspection of suit, blazer, shirt, vest, style variants, side/back views, measurement mode and a 390×844 phone.
- Actual verification evidence: profile and model builds reproducible; typecheck, lint, 29 unit tests, production build and 9 of 9 Playwright scenarios passed; renders inspected at desktop and 390×844. Details in [TEST-EVIDENCE](../implementation/TEST-EVIDENCE.md).
- Deviations and decision references: D-016. Measurement mode keeps the unclothed anatomical body.
- Remaining limitations: illustrative shapes only, not tailor-validated; no creases or cloth folds beyond the pressed trouser crease; hair and face are unchanged; generation takes about 65 ms on the test container per shape change and has not been measured on a real mid-range phone.
- Changed files/commit: see the branch commit on `claude/interface-chat-input-3d-2d-a0uq1q`.
