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

## TASK-015 (M1, WP-01 – WP-08) — Catalog foundation, 28 September 2026

Environment as WP-00a: Windows 11, Node 22.17.1, npm 11.6.2, local PGlite databases in temporary directories, Playwright 1.63.0 with bundled Chromium. Branch `feature/phase0-m1-catalog-foundation`. No hosted PostgreSQL, no external service, no real customer or supplier data. The catalog content is the user-supplied reference seed (D-014), reference-only; every other fixture is labelled SYNTHETIC.

| Executed check | Result |
| --- | --- |
| `npm run check` | Passed: typecheck, lint, **152 Vitest tests in 15 files**, production build |
| `npm run test:e2e` | **10 of 10 passed** (1.4 min), including the new `tests/e2e/catalog.spec.ts`: `GET /api/ready` through the real development server bootstrapped catalog v1 on the existing QA database and returned 200 `ready` with `no-store`; a second check stayed ready. The existing studio and human-preview journeys are unchanged. The existing QA database from the baseline run re-ran every migration on start without error |
| `npm run catalog:bootstrap` twice on a temporary PGlite directory (`DATABASE_URL` set empty so the local `.env` value is not used) | First run: “Published catalog v1 from the reference data (reference-only).” (about 5 s including database start and migrations). Second run: “A catalog release already exists (current v1); nothing to publish.” |
| Prettier on every new and changed file (`--end-of-line auto`) | Passed |

Automated coverage added (tests, not claims):

| Test file | What it proves |
| --- | --- |
| `tests/migrations.test.ts` (11) | `0003_catalog.sql` is split-safe; all migrations run twice on one directory as whole files and as `;`-split statements; the Drizzle mirror matches the migrated database (tables, columns, types, nullability, primary keys); constraint smoke tests; the audit writer commits and rolls back with its transaction and accepts only scalar summaries |
| `tests/money.test.ts` (8) | `parseMoney` exact parsing and rejections; currency allowlist; canonical JSON key-order independence |
| `tests/catalog-snapshot.test.ts` (13) | The SYNTHETIC fixture parses and covers every condition type; every operator, nesting, the depth-6 and 50-node limits and unknown codes |
| `tests/visual-registry.test.ts` (9) | Every selection key the renderers read has a slot (source scan); tokens equal the seed and imported values; deriving 3D coverage from slots reproduces `coverage.ts`; region ids |
| `tests/import-legacy.test.ts` (15) | Determinism; 434 seed choices accounted for (428 active + 6 documented archived placeholders); shirt, blazer, vest, fabric, media, lookup and binding mapping; reference-only throughout |
| `tests/catalog-working-copy.test.ts` (6) | Import → load → compile equals the import; reloading is a no-op; draft and archived rows excluded; live availability kept; a SYNTHETIC snapshot round-trips every entity type; restoring the import gives the original checksum |
| `tests/validate-release.test.ts` (41) | One failing fixture per error and per warning code; the import has no errors; warnings checksum; effective selections and rules; the customer projection strip list and size; diff |
| `tests/release-repository.test.ts` (9) | Bootstrap v1 (reference-only, warnings acknowledged by `system:bootstrap`, first publication stamped, audit rows); idempotent re-run; release LRU; `nothing_to_publish`; `publish_blocked`; `warnings_unacknowledged`; concurrent publishes → one `stale_release`; action replay and `action_conflict`; restore v1 then publish → v5 with v1’s checksum and `restored_from_version = 1` |
| `tests/catalog-readiness.test.ts` (3) | Production without a release → 503 `catalog_unavailable` and `/api/ready` 503 `not_ready`/`catalog_missing`; auto-bootstrap off → not ready; default development → ready with v1 |

Measured on the import: snapshot 336 KB, customer projection 283 KB, validation report 125 KB (210 `reference_price_unset`, 470 `rights_unconfirmed`, 16 `price_missing`, 14 `image_missing`, 8 `supplier_missing`, 1 `reference_only_present`).

Test-harness note: the suites that start PGlite or load the whole catalog take a few seconds each and exceeded Vitest’s 5-second default when all files ran in parallel. They now use an explicit 30-second limit (`PGLITE_TIMEOUT` in `tests/helpers/db.ts`); no assertion changed.

Not verified: hosted PostgreSQL (the `;`-split path is exercised on PGlite only), true parallel publish sessions (PGlite serialises transactions on one connection, so the concurrency test proves the lock-and-version logic only), any admin or customer surface using releases (later tasks), and production operation. The e2e run rewrote the committed human-preview screenshots; they were restored from Git because M1 changes no UI.

### CI fix on the M1 pull request, 28 September 2026

The GitHub `Validate` workflow failed at `npm ci` on this branch and on `master`: `package-lock.json` had been written by npm 11 and lacked the top-level `@emnapi/runtime` and `@emnapi/core` entries that npm 10 (bundled with Node 22, used by CI and by a default Replit Node 22) requires. The lock was regenerated with `npx npm@10 install --package-lock-only`: only entries were added (no existing version changed; npm 11's `"peer": true` flags were dropped). `npm ci --dry-run` passes with npm 10.9.9 and 11.6.2; the old lock reproduced CI's exact error with npm 10.

The next CI step, `npm run format:check`, would then have failed on the formatting drift recorded under WP-00a. The 12 affected source and test files (including `design-outline.ts`, whose WP-05 export made a line too long) were formatted with Prettier, with no logic change. The two CC0 licence texts and the generated `human-reference-v1.manifest.json` were added to `.prettierignore` so they stay verbatim and byte-identical with their build script. `tests/repository.test.ts` got the same explicit `PGLITE_TIMEOUT` as the other PGlite suites; it timed out once under parallel load now that start-up runs migration 0003.

Re-run locally: `npm run check` passed (152 tests, build); `prettier --list-different --end-of-line auto .` reported nothing (the CRLF-only differences of this Windows checkout do not occur on the Linux runner); `npm run test:e2e` 10 of 10 passed.
