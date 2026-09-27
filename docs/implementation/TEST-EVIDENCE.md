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
