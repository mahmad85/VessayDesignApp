# Application architecture

Status: target architecture v0.2 with the authorized foundation implemented under ADR-010. See [implementation status](../implementation/STATUS.md) for the boundary between implemented and planned services.

## Boundaries

Use a TypeScript modular monolith deployed as a standard Next.js Node application. Keep presentation, application services, domain rules, and vendor integrations separate. Modules are catalog, configuration, consultation, measurements, pricing/orders, and administration. Module extraction is a later response to measured workload or ownership needs, not a prerequisite for Phase 1.

Proposed repository areas: src/app for routes and presentation; src/modules/<module> for domain and application services; src/integrations for provider adapters; src/db for schemas and migrations; src/ui for shared controls; src/visualization for renderer and asset interpretation; tests for test suites; docs for this specification. Avoid a universal services file or putting all business rules in route handlers.

Browser responsibilities: responsive presentation, controlled local preview, 3D rendering and camera state, accessible forms, showing server-accepted configuration. Server responsibilities: authorization, validation, configuration transitions, prices, catalog retrieval, external calls, measurement provenance, order snapshots and durable workflow submission.

PostgreSQL is authoritative for product data and state. Replit App Storage contains durable files. Authentication is behind an identity boundary: Better Auth self-hosting is the preferred current proposal, with Clerk as the managed alternative pending Q-020. The application owns roles and authorization. OpenAI is a consultation provider. 3DLOOK supplies scan results through a verified adapter. Inngest orchestrates bounded handlers deployed with the application.

## Request and background behavior

User commands validate ownership, expected revision and domain rules, commit atomically, then return the canonical state. Streaming text must not imply a selection was saved before its command commits. Slow provider work uses persistent job identities and asynchronous status, not an in-memory background promise after a web request ends.

Persist pending external-work events with the associated state change (transactional outbox). A dispatcher sends them to the workflow service; retries are safe. Consumer handlers deduplicate by event/job ID. Checkpoint provider job IDs before later retrieval. Callback handling verifies provider authenticity using the contracted mechanism. If that mechanism is not available, use authenticated retrieval rather than trusting arbitrary callbacks.

Every slow result carries the input configuration/capture revision. When it returns, compare with current state before application. Completed work may be retained as an alternative revision; it must not erase newer edits.

## Replit deployment

Use Autoscale initially with durable externalized state and bounded database pools. Choose supported pinned runtime/package versions. Standard production build/start scripts, health endpoints, environment configuration and secrets must be documented during foundation implementation.

Replit development and published production have separate databases. Provision staging with isolated credentials/data. Use one reviewed migration mechanism; determine how it interacts with Replit's publish-time schema changes before the first migration. Do not run independent schema changes in every autoscaled instance or combine conflicting automatic migration systems.

No customer data is persisted only on the application filesystem. Model/texture assets are versioned and delivered from durable storage with appropriate caching; customer files have authenticated access. Private responses must never enter shared public caches. Shared catalog-cache invalidation and Next.js multi-instance behavior must be designed before enabling shared dynamic caches.

## Portability

Isolate SDK calls behind small interfaces: StorageProvider, IdentityResolver, ConsultationProvider, MeasurementProvider, WorkflowPublisher and PaymentProvider plus NotificationProvider. Domain objects use internal IDs and versions, not provider-specific response shapes. This reduces migration scope; it does not eliminate data migration, provider adaptation, or integration retesting.

Keep standard PostgreSQL schema/migrations and reproducible dependency locks in Git. Replit remains the initial deployment target. GPU computation and body reconstruction are external provider responsibilities in Phase 1.

## Sources checked 2026-09-26

- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Replit deployment types](https://docs.replit.com/features/publishing/deployment-types)
- [Replit databases](https://docs.replit.com/features/data-and-storage/development-and-production)
- [Replit App Storage](https://docs.replit.com/features/data-and-storage/object-storage)
- [Inngest Next.js](https://www.inngest.com/docs/getting-started/nextjs-quick-start)

These references establish platform capabilities. They do not certify this application's hosted behavior or costs.

## Review and checkout extension

Add a Review service within pricing/orders, with versioned findings and deterministic eligibility. Payment and notification adapters are Phase 1 boundaries. The automated check, the customer’s sign-off, paid status, the optional post-payment tailor review and fulfillment release are independent facts (D-020). See [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md). See [BACKEND-AUTH-DECISION.md](BACKEND-AUTH-DECISION.md) for the requested FastAPI/authentication comparison; Node remains the recommendation, not a user-ratified irreversible choice.
