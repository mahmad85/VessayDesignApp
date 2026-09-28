# Executed evidence — 26 September 2026

Environment: Linux, Node 24.19.0, npm 11.9.0, Chromium 153 headless with software WebGL. Application supports Node >=22; the Node 22 CI workflow is supplied but has not been run on GitHub in this session.

| Gate | Observed result |
| --- | --- |
| TypeScript check | Passed |
| ESLint | Passed, no reported warnings/errors on the final checked source |
| Vitest | 15 tests passed across two files |
| Next.js optimized production build | Passed |
| Playwright | Six browser/API acceptance flows passed |
| axe WCAG A/AA tagged checks | No violations found in the tested initial desktop studio state |
| npm audit | Zero reported vulnerabilities at the time of the check |
| Migration command | Initial migration command passed on development PGlite; hosted PostgreSQL remains untested |

## Domain and repository coverage

The tests verify unaccepted defaults, invalid/incompatible fabrics, category-reset consent and preservation of preferences, invalidation of review, measurement-boundary validation, missing/unknown fields, measurement version/source semantics, display-unit conversion, blocked payment and unavailable human review. Guided recommendations use compatible IDs and do not mutate accepted selections.

Repository tests run SQL on an isolated PGlite database. They verify owned-draft isolation, reload persistence, duplicate action replay, conflicting reuse of an action ID, concurrent stale-edit rejection, guest transfer without overwriting an existing account draft, and database rate limits.

## Browser coverage

1. Design choices through direct controls and conversation, explicit suggestion application, persistence after reload, 3D canvas, manual measurements/unit switching and review blockers.
2. Category change cancellation/acceptance and category-specific fabric/detail controls.
3. 390 px mobile panel switching, unavailable 3DLOOK state and unsaved-measurement navigation warning.
4. API origin rejection, separate guest ownership, blocked checkout and unavailable capture.
5. Real Better Auth signup, local verification email, rejection before verification, verified sign-in, guest-draft claim and sign-out.
6. Keyboard dialog open/Escape/focus return, automated desktop accessibility checks and no horizontal overflow at 768 and 320 px.

The first visual/accessibility pass found low-contrast metadata, missing dialog focus return and 320 px navigation overflow. These were corrected and the affected checks subsequently passed. The updated numeric measurement annotation and preview screenshots were checked in a targeted journey rerun.

## Evidence files

`artifacts/01-design-desktop.png` through `artifacts/06-design-tablet.png` show the actual running application. Any numeric measurements in screenshots are synthetic test values, not user measurements. The rendered model is an interactive reference, not an output from 3DLOOK.

## Not verified

- No hosted Replit deployment or external PostgreSQL validation/restore.
- No live OpenAI, 3DLOOK, payment, staff-review or email provider calls.
- Password-reset UI and adapter exist; the full reset/invalidation journey is not yet covered by the browser suite.
- No production asset correctness, drape/fit accuracy, supported-device GPU performance, load or autoscale test.
- No full screen-reader or every-state WCAG assessment; no accessibility certification is claimed.
- No penetration test, production retention/erasure or incident rehearsal.

React Three Fiber currently emits a Three.js Clock deprecation warning; the scene renders and the browser journey has no uncaught page errors. Review the renderer dependency pairing in maintenance before broad device release.

## TASK-011 — Full human reference, 27 September 2026

Environment: Windows, Node 22.17.1, installed Chrome in headless mode with software WebGL. The running local development server was reused. Direct Node entry points were used because the shell's npm shim resolves to a missing global npm installation; no package installation or dependency replacement was needed.

| Executed check | Result |
| --- | --- |
| `node scripts/build-human-model.mjs` | Produced valid locally loadable GLB, manifest, texture and CC0 license; GLB 1,738,008 bytes, eye PNG 610,817 bytes |
| `node node_modules/typescript/bin/tsc --noEmit` | Passed |
| `node node_modules/eslint/bin/eslint.js .` | Passed |
| `node node_modules/vitest/vitest.mjs run` | 15 tests passed across two files |
| `node node_modules/next/dist/bin/next build --webpack` | Passed on final runtime source |
| Playwright `human-preview.spec.ts` | Two tests passed: full-human asset load, camera keys, garment/construction changes, measurement annotation, responsive views, and asset-failure fallback |
| Full Playwright run + targeted journey rerun | All eight scenarios passed across runs; seven passed initially, one stopped on a pre-existing screenshot file write error and passed after redirecting only its output directory |
| Changed-code Prettier check | Passed |

The browser suite uses `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe`. Set `VESSY_E2E_ARTIFACT_DIR` to preserve existing journey screenshots when collecting a new run. No acceptance assertion was removed or relaxed to resolve the file error.

Visually inspected `artifacts/human-preview/`: suit desktop, front, side, back and zoomed detail; checked fabric with relaxed fit, peak lapels, patch pockets and one button; shirt and blazer front/side; anatomical measurement reference; 1440×900 desktop, 768×1024 tablet, 390×844 mobile and 320×740 narrow layout. Fresh full journey evidence is under `artifacts/human-preview/journey/`. Refinements after inspection removed layered garment intersections and kept shoes clear of the small-screen controls.

The local model has facial anatomy, short hair, individual fingers and toes. It is an interactive generic human reference, not a scan or photographic likeness. The test does not establish real-device frame rate, cloth/fit accuracy, full production asset coverage, screen-reader certification or vendor validation. No deployment or external approval occurred. CC0 sources and reproducible preparation are documented in `assets/human-source/README.md`; full scope is in [TASK-011](../delivery/TASK-011.md).

## TASK-012 — Supplied suit Style and Accents seed, 27 September 2026

Environment: Windows, Node 22.17.1, installed Chrome in headless mode. The final browser run used the current Next.js development server at `localhost:3000`. Direct local binary entry points were used because the machine's global npm shim points to a missing npm installation.

| Executed check | Result |
| --- | --- |
| `node scripts/build-suit-customization-seed.mjs` | Produced 434 options across Style and Accents; copied 478 local files into the isolated reference asset directory |
| Local TypeScript binary with `--noEmit` | Passed |
| Local ESLint binary against the repository | Passed with no reported warnings/errors |
| Local Vitest binary | 17 tests passed across two files, including seed count/identity/assets, server rejection and two-way mapped-control synchronization |
| `node node_modules/next/dist/bin/next build --webpack` | Optimized production build passed |
| Playwright `human-preview.spec.ts` with installed Chrome | Two tests passed in 19.4 seconds after final browser-test corrections; catalog selection, server persistence/reload, keyboard camera controls, responsive layouts and model-failure fallback passed |
| Changed-code Prettier check | Passed |

The browser pass exposed that the expanded catalog could extend under the action footer at a 1440×900 viewport. The design-control region now has a bounded, independently scrollable height; a direct Chrome interaction check confirmed the previously covered Half Canvas option can be clicked, and the final two-scenario browser run passed. The test explicitly returns to the Fabric tab after reload because Radix/browser state restoration can retain the last selected Style tab; this changes only navigation, not the persistence assertion.

Visually inspected `artifacts/human-preview/suit-style-catalog.png` and `suit-accents-catalog.png`, plus the regenerated 768×1024, 390×844 and 320×740 preview screenshots. The seed is locally verified reference data. It does not establish supplier authority, stock, approved prices, manufacturing compatibility, asset publication rights or production readiness; full scope is in [TASK-012](../delivery/TASK-012.md).

## TASK-013 — Unified design input and interactive 2D preview, 27 September 2026

Environment: Linux cloud container, Node 22.22.2, Playwright with the bundled Chromium (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium`, SwiftShader WebGL). Browser tests started their own development server with the synthetic configuration in `playwright.config.ts`.

| Executed check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed, no warnings or errors |
| `npx vitest run` | 24 tests passed across three files, including 7 new outline, change-detection, region-mapping and drawing-spec checks |
| `npm run build` | Optimized production build passed |
| Full Playwright run | 8 of 9 passed on the first run. The failure was a wrong step order in the updated category-change test (Fit comes before Collar); after correcting the test navigation and making one locator exact, the studio file passed 7 of 7. `human-preview.spec.ts` passed 2 of 2 in the full run and was not changed afterwards |
| Accessibility (axe, WCAG 2.2 AA tags) | No violations on the chat view with the 2D drawing, or on the Choose details navigator opened to Jacket › Lapels |
| Prettier on changed files | Passed |

The new browser scenario checks that opening a group zooms the drawing; a field choice updates the callout and its tag; a vent change switches the drawing to its back; a trouser change returns to the front; 3D → 2D switching and reload keep the saved choice; a drawing edit marker opens its editor; and keyboard zoom changes the view. The journey test checks that an accepted assistant suggestion focuses the drawing and appears as an editable tag.

Visually inspected 1440×900 desktop screenshots of both input modes, jacket style, lapels, pockets, sleeve, back vent, trousers with the jacket faded, vest, necktie, lining (custom and quilted), monogram, the shirt, the 768×1024 stacked layout, and 390×844 and 320×740 phone layouts (`artifacts/07-design-2d-fields.png`, regenerated journey and `human-preview` screenshots). The drawing is an illustrative technical sketch; it has no tailor sign-off, real-device performance measurement or screen-reader certification. 3D rendering is unchanged.

## TASK-014 — Generated 3D garments, 27 September 2026

Environment: Linux cloud container, Node 22.22.2, bundled Chromium with SwiftShader WebGL; Playwright started its own development server with the synthetic configuration.

| Executed check | Result |
| --- | --- |
| `node scripts/build-human-model.mjs` after moving body preparation to `scripts/lib/human-body.mjs` | GLB and manifest byte-identical to the previous output |
| `node scripts/build-garment-profiles.mjs` | 76 torso, 41 arm and 76 leg sections; 66 KB table in 0.7 s |
| `npx tsc --noEmit`, `npm run lint` | Passed |
| `npx vitest run` | 29 tests passed across four files, including 5 new garment checks: finite geometry for all products and closures, construction per option, a geometry change for each main 3D choice, layer clearance (jacket over vest over shirt, jacket and vest over the trouser waistband) and 3D coverage IDs |
| `npm run build` | Optimized production build passed |
| Full Playwright run | 9 of 9 passed, including the full-human 3D test with garment changes, camera keys and responsive views |
| Garment generation timing (Node, warm) | About 65 ms for a complete outfit, about 71,000 triangles |

Visually inspected 3D renders: default suit front/side/back and close-up; double-breasted 6-button; Mandarin; peak/wide and shawl/slim lapels; relaxed fit with vest; blazer with neutral trousers front and side; dress shirt; measurement mode (unchanged); the 390×844 phone preview; and the "shown in the 2D drawing" hint for lining. Inspection led to four corrections before the final run: straight tapered trousers, a longer jacket hem, waistband clearance under the jacket (visible only on the blazer) and a straight back drape over the seat.

Not established: real mid-range phone frame rate or generation time, tailor review of shapes, cloth folds, or screen-reader certification.

## WP-00a — Baseline verification on `master`, 28 September 2026

Environment: Windows 11, Node 22.17.1, npm 11.6.2, Playwright 1.63.0 with its bundled Chromium (software WebGL). Commit `20741c2` (unchanged `master`), run on branch `feature/phase0-m1-catalog-foundation` before any code change. Playwright started its own development server with the synthetic configuration in `playwright.config.ts`.

| Executed check | Result |
| --- | --- |
| `npm run check` (typecheck, lint, Vitest, production build) | Passed. Vitest: 29 tests across 4 files |
| `npm run test:e2e` | 9 of 9 passed in 1.5 min. The logged “Could not load /models/human-reference-v1.glb” error comes from the deliberate asset-failure scenario, which passed |
| `npm run format:check` | **Failed: 42 files reported.** 26 of them differ only by line endings (this checkout uses `core.autocrlf=true`, so files are CRLF on disk while Prettier expects LF). The other 16 have genuine formatting drift already committed on `master`: `src/app/api/measurements/saia/[captureToken]/route.ts`, `src/app/api/scan-service/{checkout,policy,webhook}/route.ts`, `src/components/{measurement-panel,saia-measurement-widget}.tsx`, `src/db/{saia-repository,schema}.ts`, `src/integrations/3dlook.ts`, `src/lib/{http,saia-draft,scan-service-policy}.ts`, `tests/e2e/studio.spec.ts`, `assets/human-source/LICENSE.md`, `public/models/LICENSE-CC0.md` and `public/models/human-reference-v1.manifest.json` |

The e2e run rewrites the committed screenshots under `artifacts/`; they were restored from Git after the baseline run so the existing evidence stays unchanged. Unrelated formatting drift was not reformatted. Files changed by later packages are formatted as they are touched (`npx prettier --check --end-of-line auto <files>`).

Shared test helpers added in WP-00a (synthetic data only):

| Helper | Purpose | Smoke test |
| --- | --- | --- |
| `tests/helpers/db.ts` | `setupTestDatabase()`: a migrated PGlite database in a new temporary directory per test file | `tests/helpers.test.ts`; now also used by `tests/repository.test.ts` |
| `tests/helpers/http.ts` | `apiRequest()`: a `NextRequest` with an `Origin` header, cookies and a JSON body, for calling route handlers directly; `cookiesFrom()` | Calls `GET`/`POST /api/studio`, including the 403 `invalid_origin` path |
| `tests/helpers/users.ts` | `createSyntheticUser()`: signs up through Better Auth, verifies the email in the test database and returns a session cookie | The session resolves to the user in `GET /api/studio`; an unverified variant stays unverified |

After WP-00a: Vitest 33 tests across 5 files passed; typecheck and lint passed; Prettier passed on the new and changed test files.

## WP-00b — Golden visual outputs before any renderer change, 28 September 2026

Environment as WP-00a. Generated with `node --import tsx tests/golden/generate.ts` on the unchanged renderers (`sketch-spec.ts`, `focus-regions.ts`, `garments/coverage.ts` untouched).

| Golden | Content |
| --- | --- |
| `tests/golden/sketch-spec.json` | `sketchSpec()` for 473 SYNTHETIC designs: suit defaults; each of the 434 seed choices applied one at a time (with the vest and the group’s gate opened where the choice needs them to be drawn); suit fit, fabric and skin tone; shirt and blazer defaults plus every legacy fit, detail and fabric option. Stored as one baseline per product plus each case’s exact differences (lossless; 87 KB instead of 652 KB) |
| `tests/golden/regions.json` | `regionForLeaf()` for all 54 leaf ids (every seed group plus the legacy leaves), per product outline, and the contextual cases (thread scope, changed back-pocket key, shirt fabric) |
| `tests/golden/shown-in-3d.json` | `shownIn3D()` for the same 54 leaf ids (24 drawn in 3D) |

| Executed check | Result |
| --- | --- |
| `npx vitest run tests/golden.test.ts` on the unchanged code | 4 tests passed |
| Mutation check: one button colour constant in `sketch-spec.ts` changed temporarily | The comparison failed on exactly `suit/accents.jacket.buttons_color.colors=1`; the constant was restored from Git and the test passed again |

Rule for later packages: a golden may be regenerated only with a written justification in the PR and an explicit reviewer sign-off; never to make a failing comparison pass.
