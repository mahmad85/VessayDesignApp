# PR-2 CI: staff enrollment before hydration

Status: implemented and locally verified on 2026-09-29; GitHub CI results are recorded on PR #2. Not released.

- Approved baseline: D-019, TASK-018 / WP-19–21, retained v0.2 foundation and admin overlay.
- Implementation authorization/source: user requested monitoring and automatic fixes for PR #2 on 2026-09-29.
- Requirement IDs and canonical files: AUTH-004 in BACKEND-AUTH-DECISION.md; ADM-002 in ADMIN-SCREENS.md and ADMIN-BACKEND.md §3.2; OPS-001 in SECURITY-RELEASE.md.
- Acceptance scenario IDs: AC-31 and AC-42. Existing authorization assertions (AC-18) are retained.
- User-visible outcome: staff enrollment shows “Loading secure setup…” with disabled controls until the client can handle submission, then supports the existing password → authenticator → backup codes → admin flow.
- In-scope surfaces/modules: SecuritySetup and the staff Playwright journey. The test derives its Origin header from its configured base URL so isolated local runs can use another port.
- Dependencies and blocking questions: Q-025 staff recovery/session policy and Q-022 production email remain release gates.
- Explicit non-goals: changing MFA enforcement, library versions, CI retries/timeouts, live integrations, deferred AI, merging or deploying.
- Data/API/asset contracts: Better Auth two-factor enable/verify APIs and server-side staff guards are unchanged.
- Loading/error/empty/recovery behavior: server and initial hydration snapshots disable the password field and submit action. The client snapshot enables them after hydration; existing API error/retry handling remains.
- Authorization and privacy requirements: no staff access is granted by the readiness flag. Fixtures are synthetic; setup secrets and QR codes are masked in retained screenshots.
- Migration/compatibility implications: no schema, environment, dependency or workflow changes.
- Test fixtures: isolated PGlite database and CLI-granted synthetic owner. The user's PostgreSQL-backed localhost app stays on port 3000; this local browser run uses 3100.
- Verification plan: deterministic delayed-script regression, existing keyboard/MFA/denial journey, responsive visual/accessibility checks, repository checks, and latest-head GitHub Actions.
- Actual verification evidence: the focused staff suite, full repository checks and formatting passed; see below. Latest-head GitHub CI remains a separate check on PR #2.
- Deviations and decision references: none. Existing product/external-release gates remain open.
- Remaining limitations: this fixes one demonstrated enrollment race; it does not establish production authentication readiness or full M4 acceptance.
- Changed files/commit: src/components/admin/security.tsx, tests/e2e/staff.spec.ts, these evidence/status/traceability records and masked enrollment screenshots; included in the CI-fix commit on PR #2.

## Diagnosis and regression evidence

The pull-request [failed run 36564611157](https://github.com/mahmad85/VessayDesignApp/actions/runs/36564611157) passed repository checks but failed one of 16 browser tests at the expected manual setup key. Its trace contains a GET to /admin/security? immediately after keyboard submission, with no request to the two-factor enable API. The same head's [push run 36564528320](https://github.com/mahmad85/VessayDesignApp/actions/runs/36564528320) passed, consistent with a timing-dependent defect.

The new regression holds Next.js script requests during a full reload and checks that the server-rendered password and submit controls are disabled. Before the fix it failed because the password field remained enabled. After the fix, the focused staff suite passed **2/2** in 1.0 minute with the original 60-second test timeout and no retries. Scripts are released before the existing keyboard enrollment, backup-code acknowledgement, role/audit and TOTP sign-in assertions. The ordinary-customer denial test also passes.

Local command: npx playwright test --config .data/ci/playwright.config.ts tests/e2e/staff.spec.ts. The ignored config imports the repository config and changes only the server port/base URL and helper paths for isolation. CI uses the normal repository config and port 3000.

The browser journey produced ten enrollment/admin screenshots and passed axe and keyboard assertions. Enrollment was visually inspected at [1440](../../artifacts/ci-pr2/enrollment-1440.png), [1024](../../artifacts/ci-pr2/enrollment-1024.png) and [768](../../artifacts/ci-pr2/enrollment-768.png) pixels, with no clipped controls or layout regression.

## Repository validation

- npm run check passed: typecheck, lint, **316 tests in 37 files**, and the optimized production build.
- npm run format:check and git diff --check passed. The fresh Windows checkout initially used CRLF; its committed LF endings were restored locally before formatting verification. No repository-wide content or formatting change is included.
- npm ci installed the existing lockfile and reported **0 vulnerabilities**. No dependency was added or upgraded.
- The original localhost service on port 3000 still returned a healthy response after isolated testing.
