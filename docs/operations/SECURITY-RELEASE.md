# Security, operations and release requirements

Status: proposed v0.2. Retention durations and recovery targets remain open decisions. These requirements respond to body data, commercial state and external processing in this product.

SEC-001: Every API and asset access MUST check authenticated/guest-session ownership and role scope server-side. Application roles control catalog, tailoring and support access. Client IDs, prices and roles are untrusted. Sensitive configuration and responses must not enter shared public caches.

SEC-002: Store credentials only in environment secrets; never include server keys in frontend bundles or Markdown. Separate development/staging/production credentials, provider environments and data. Guest drafting uses secure ownership binding and a reviewed transfer to an account before private operations.

SEC-003: Record consent purpose/version/time before required capture. Collect only necessary data. Body photos and provider outputs have restricted access and a documented retention/deletion lifecycle. Finalize exact durations, provider obligations and deletion handling before real customer capture release. Disable session replay/screenshots on sensitive measurement/photo screens unless specifically reviewed and consented as required.

SEC-004: Validate upload type, size, content and access purpose. Approved limits are set after provider/media constraints are verified. Do not accept arbitrary executable content or publish private object URLs. Logs and analytics exclude raw photos, body values, credentials and unnecessary conversation content.

SEC-005: Rate-limit expensive/sensitive actions by appropriate account/session and infrastructure controls. Verify external result authenticity; protect action/session tokens and apply CSRF protections appropriate to the chosen session mechanism. Handle duplicate events and retries through durable IDs.

OPS-001: Use Git, pinned dependencies/lockfile, type checking, linting, relevant automated tests and reviewed migration changes. Changes are associated with requirement/task IDs. Product/schema changes must have an impact entry. Never silently auto-upgrade major libraries during feature work.

OPS-002: Run one controlled migration path with staging verification and an explicit interaction plan for Replit publishing. Document database/object-store backups and demonstrate recovery before production. Exact recovery time/point targets require Q-016 resolution. A code rollback alone may not roll back data safely.

OPS-003: Persist job state/outbox and use bounded retries/timeouts. Keep original provider references. Do not automatically retry operations that could charge/create a second scan without documented idempotency. Instrument job age, failure rates, duplicate deliveries and manual recovery.

OPS-004: Monitor application errors, database saturation, consultation latency/cost, provider capture success/failure, asset performance and order consistency. Correlate with pseudonymous request/job IDs. Set spend limits and alerts once the contracted services and pilot load are known.

OPS-005: Release requires authorized scope, approved baseline for affected slices, acceptance evidence, configured production identity/secrets, isolated data, production-disabled mocks, recoverable migrations and known incident ownership. Do not claim production ready from a successful local build.

## Proposed performance budgets to validate

| Area | Starting proposal | Measurement condition |
| --- | --- | --- |
| Direct-control feedback | Local pressed/preview feedback within 100ms | Representative supported device |
| Ordinary configuration save | p95 below 1s excluding external AI/provider work | Warm application under agreed pilot load |
| AI waiting feedback | Acknowledge sending immediately; show actual working status | Include slow and failed provider conditions |
| 3D interaction | Aim for 30fps or better on agreed midrange test device | One representative complete scene; define asset budget from evidence |
| Processing progress | Status-based, no unverified completion deadline | Provider contract and measured pilot behavior |

These are proposed targets, not platform guarantees or observed performance. Specify network/device/load assumptions and revise through the decision process. Cold starts, media payloads, connection pools and streaming proxies must be measured on the published Replit application.

## Release checklist ownership

Technical owner verifies deployment/restore/monitoring; product owner verifies customer flow and commercial copy; tailor verifies measurement definitions and production requirements; integration owner verifies vendor behavior; 3D owner verifies asset coverage. Roles may be held by the same person but the checks remain distinct.

## v0.2 release additions

Payment release requires verified provider integration, explicit customer consent to the current total, signed/authoritative payment reconciliation, duplicate/late event handling and an amendment/refund policy. Tailor-review release (post-payment, D-020) requires staffed SLA ownership and overdue escalation. The automated check is a payment gate made of deterministic checks and customer sign-off (D-020). Tailor-labelled evaluation of its advice is quality monitoring (REV-008), not a release gate. Sending body measurements to the AI provider needs a privacy decision first (Q-032). Self-hosted authentication, if selected, must satisfy AUTH-001 through AUTH-005 in [BACKEND-AUTH-DECISION.md](../architecture/BACKEND-AUTH-DECISION.md). No live payment or customer notification is authorized by this specification update.
