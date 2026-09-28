# TASK-018: Staff roles, MFA, audit and admin shell

Status: ready (specified 2026-09-28; depends on TASK-015 for `audit_events`)

Implementation packages: WP-19 – WP-21 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019; AUTH-004; SEC-001.
- Implementation authorisation/source: D-019 (the user selected tailor and support staff screens).
- Requirement IDs and canonical files: ADM-001, ADM-002 and ADM-003 in [ADMIN-SCREENS.md](../ux/ADMIN-SCREENS.md) §6; ADMIN-BACKEND §3 and §4.2; AUTH-004 and AUTH-005; UX-012; UX-018.
- Acceptance scenario IDs: AC-18, AC-31, AC-42.
- User-visible outcome: a staff member signs in, enrols TOTP at `/admin/security`, and reaches `/admin` with a sidebar filtered by role. Owners manage staff roles (ADM-17 Staff tab) and read the audit log.
- In-scope surfaces/modules: `migrations/0004_staff.sql`; `schema.ts` (`staffRoles`, `twoFactor`, `user.twoFactorEnabled`); `lib/auth.ts` (`twoFactor` plugin); the account UI client plugin and TOTP challenge on sign-in; `modules/staff/{permissions,authorize}.ts`; `db/staff-repository.ts`; `scripts/staff-grant.ts` plus the `staff:grant` package script; `app/admin/security`; `app/admin/(guarded)/layout.tsx` with the sidebar; ADM-01 skeleton; `/api/admin/me`, `/api/admin/staff`, `/api/admin/staff/grants`, `/api/admin/staff/revocations`, `/api/admin/audit`; `http.ts` `body()` `maxBytes` option and `validation_failed` details for admin routes.
- Dependencies and blocking questions: staff session lifetime policy (Q-025); the production email provider (Q-022) for staff account recovery.
- Explicit non-goals: customer MFA, SSO, Better Auth `admin` plugin roles.
- Data/API/asset contracts: API-REFERENCE §3.1; the permission matrix in ADMIN-BACKEND §3.1.
- Loading/error/empty/recovery behaviour: a non-staff user at `/admin` gets 404. Staff without MFA are redirected to `/admin/security`. A lost authenticator uses the backup codes, or an owner’s CLI re-grant after identity verification (documented runbook).
- Authorisation and privacy requirements: roles are server-side only; MFA is always required in production; audit summaries contain no personal data.
- Migration/compatibility implications: additive. Better Auth column and table names must match the plugin schema (ADMIN-BACKEND §4.2). Existing customer sign-in is unaffected when the user has no 2FA.
- Test fixtures (synthetic or authorised): synthetic staff accounts created in test databases only.
- Verification plan: a route-handler matrix test for every role and permission (API-REFERENCE §4); e2e TOTP enrolment using a TOTP code computed in the test from the returned secret; the last-owner guard; keyboard pass of the sidebar and security page.
- Actual verification evidence: not started.
- Deviations and decision references: D-019.
- Remaining limitations: staff recovery runbook and incident owner (Q-016).
- Changed files/commit: —
