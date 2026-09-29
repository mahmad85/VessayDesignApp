# Staff access — development operator guide

Scope: TASK-018, WP-19–21; D-019. Roles belong to Vessy, and Better Auth supplies password authentication, TOTP and single-use backup codes.

## First owner

1. Use the intended development database. For external PostgreSQL, run `npm run db:migrate` first. Embedded development PostgreSQL runs the additive migration automatically.
2. Register an account at `/account` and verify its email. Development email is in the private `.data/mail` outbox. No unverified account can receive a staff role.
3. With the development server stopped when using PGlite (one process owns its data directory), run `npm run staff:grant -- --email <verified-email> --role owner`. The script uses the same database configuration as the app and records `system:cli` in the audit log.
4. Start the app and open `/admin`. Set `STAFF_MFA_REQUIRED=true` to exercise the production enrollment requirement in development. Production always requires MFA, regardless of this environment setting.
5. Confirm the account password, scan the QR code with an authenticator app or enter the manual setup key, then verify a code. Save the backup codes before continuing. QR generation is entirely local; the setup key is never sent to an external QR service.

## Staff changes

Owners use **Staff & audit** to grant roles to existing verified accounts and revoke roles. Multiple roles combine their permissions. The final owner cannot be revoked, including through the CLI. CLI revocation uses `npm run staff:grant -- --email <verified-email> --role <role> --revoke`.

Each request reloads roles from the database. Revocation therefore takes effect on subsequent requests without waiting for a cookie to expire. Mutations require a same-origin request and a database-backed rate limit; the audit event commits with the change. Audit summaries record role names and field names, never email addresses or MFA secrets.

## Authenticator recovery and release gates

At the sign-in code challenge, **Use a backup code** accepts one saved recovery code. Each code is consumed once. Enrollment invalidates existing password-only sessions; the verified browser receives a new session. No trusted-device bypass is offered by the UI.

If all backup codes and the authenticator are lost, contact the designated owner and verify identity out of band. **Granting a role again does not reset MFA.** No automatic MFA reset or identity-check bypass is supplied by the grant command. The approved owner-operated recovery procedure, identity evidence, session lifetime and incident ownership remain Q-025/Q-016 production gates. Do not edit authentication records ad hoc on a live system.

Production additionally requires validated email transport, hosted PostgreSQL migrations and restore evidence, and a security review (AUTH-005). Local tests do not constitute production approval. No live staff account is created by the test fixtures.

## Browser verification

The Playwright startup wrapper creates a clearly synthetic verified owner and runs the actual grant CLI before starting the isolated test server. It sets MFA required, disables external mail and provider credentials, and refuses to reuse an arbitrary server on port 3000. The fixture file `.data/qa-staff.json`, local emails, synthetic enrollment captures and test database are ignored by Git.
