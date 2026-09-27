# ADR-010 — Implementation foundation and development boundaries

Date: 2026-09-26. Status: applied implementation decisions under user authorization D-012.

## Decision

Implement a TypeScript modular monolith using Next.js App Router on Node, PostgreSQL with Drizzle schema/auth adapter, Better Auth, Zod, React Three Fiber/Drei and an OpenAI Responses adapter. Replit remains the deployment target. Domain commands are shared by every UI path, validated by the server and committed atomically with action receipts and prior revisions.

Use a JSONB draft aggregate for the evolving prototype configuration. This keeps command validation and snapshots cohesive. It does not replace normalized, immutable commercial order/line/quote records in the later payment slice. Better Auth tables remain ordinary relational tables.

Use PGlite only for local development and synthetic integration tests. Its PostgreSQL SQL execution lets ownership, transactions and revisions be exercised without a hosted database. Production requires `DATABASE_URL`; embedded filesystem state is rejected. A hosted PostgreSQL rehearsal is still required because local PGlite tests do not establish autoscale or network behavior.

Use reviewed SQL files through the migration script, not competing automatic schema systems. The initial migration is idempotent. Update the Drizzle schema and SQL together. Expand the controlled migration runner before adding more schema versions; do not silently modify an already-deployed migration.

Pin TypeScript 6.0.3 and ESLint 9.39.5 for the installed Next lint plugin compatibility. TypeScript 7 and ESLint 10 were tried during foundation setup, but the current plugin APIs were incompatible. Dependencies are locked; review this compatibility constraint on the next maintenance task. Lint disables the React immutability rule only for Three.js scene objects, whose camera mutations are intentional effects; application-state immutability rules remain enabled.

## Scope restrictions

The licensed 3DLOOK interface, production assets, supplier catalog, staff operation and payment provider are not available. Keep those interactions unavailable until verified; do not fabricate data for a customer-facing success path. Guided mode is disclosed and separate from the live assistant adapter. Reference geometry is a renderer fixture, not a manufacturing asset.

Avoid installing unused workflow/payment/storage frameworks in the first slice. Add the planned Inngest outbox/worker when the first actual asynchronous vendor workflow is implemented and its delivery contract is known.

## Consequences

The current code can grow into the planned production app without replacing the stack or rewriting the customer state model. Vendor adapters, catalog normalization, production assets and operational controls remain substantial work. A successful local build is not a production release or proof of live integration quality.
