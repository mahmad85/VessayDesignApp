# Replit handoff

This application targets a normal Node.js deployment. It has not been deployed in this session because no connected Replit capability is available. These instructions preserve the user's chosen host.

## Development workspace

1. Put the contents of the `vessy/` source folder at the project root in a Replit Node.js workspace. `package.json` and `.replit` must be at that root, not in two nested `vessy` folders.
2. Run `npm ci`. The lockfile is part of the source deliverable.
3. Run `npm run dev` or the workspace Run action. `.replit` maps local port 3000 to the web preview. Open the preview in a separate browser tab if Replit embeds it: the application intentionally denies iframe embedding.
4. For a credential-free development preview, leave `DATABASE_URL` absent. PGlite creates a local development database. This is for development only.
5. Set `APP_URL` to the exact origin of the workspace web preview when testing signed-in account flows or origin-checked mutations through that preview. Use the actual origin provided by Replit; do not guess it.

## Published staging

Use an isolated staging database and secrets. Do not publish a development database or use the embedded database on Autoscale.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | External PostgreSQL connection; required at production runtime |
| `APP_URL` | Exact HTTPS origin for the published application; must agree with cookie/auth/origin checks |
| `BETTER_AUTH_SECRET` | Unique strong random secret, at least 32 characters; never reuse the test fixture |
| `MAIL_API_URL`, `MAIL_API_TOKEN`, `MAIL_FROM` | Transactional mail endpoint using the adapter's documented JSON contract, token and verified sender |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional live assistant credentials/model with structured Responses support |

The generic mail transport sends JSON `{from,to:[email],subject,text}` with Bearer authentication. Confirm the selected provider accepts that contract or implement its adapter before enabling accounts. Do not assume the environment variables alone prove delivery.

1. Provision production-mode PostgreSQL for staging and take a baseline backup.
2. Run `npm run db:migrate` against that database **once as a controlled release step**. Do not add migrations to every autoscaled startup. The app uses the SQL migration files in this repository; do not run a competing auto-schema mechanism against the same database.
3. Set the build command to `npm ci && npm run build` and the run command to `npm run start`. Select Autoscale in Replit’s publishing settings. The supplied `.replit` specifies build/start commands and port 3000; Replit should write the deployment-target identifier for the selected publishing type. `PORT` can be provided by the deployment environment.
4. Verify `/api/health` for process liveness and `/api/ready` for database/schema readiness.
5. Verify persistence across redeploy, two-owner isolation, account verification/reset, guest transfer and stale-edit protection on the hosted environment.
6. Verify backup restore into a separate database before real customer data is accepted.

Authentication fails closed in production if its database, URL, secret or mail configuration is incomplete. The public design preview can still operate with the PostgreSQL database; sign-in stays unavailable. Checkout remains blocked until the commercial integration work is complete.

## Deployment limitations

- No Replit deployment, live PostgreSQL connection, mail delivery, OpenAI call or 3DLOOK call was executed for this build.
- There is no production media upload. Appearance references stay in the browser; provider/body assets require a private durable storage design in the next slice.
- Database pool maximum is eight connections per instance. Set the scale cap/pool strategy against the database limit during hosted testing.
- Body-data retention, erasure, backups, commercial policies and incident ownership are unresolved release gates.
- The preview uses an immutable in-code reference catalog. It cannot create a priced order.

## References

- https://docs.replit.com/features/project-setup/configuration
- https://docs.replit.com/features/publishing/deployment-types
- https://nextjs.org/docs/app/guides/self-hosting

Provider interfaces and publishing controls can change; recheck the current Replit interface before the first hosted release.
