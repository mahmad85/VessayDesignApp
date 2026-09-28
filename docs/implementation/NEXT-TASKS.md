# Next implementation slices

Keep working in this repository. Do not regenerate a new prototype or replace the framework to connect a vendor.

| Task | Scope | Required input and acceptance |
| --- | --- | --- |
| TASK-002 | Publish isolated Replit staging | Connected Replit workspace, staging PostgreSQL, secret ownership; hosted persistence, origin, readiness and restore evidence |
| TASK-003 | Replace reference catalog with versioned supplier catalog | Approved fabrics/IDs, prices/currency, stock, construction compatibility; catalog validation and immutable published revisions |
| TASK-004 | Enable and evaluate the live AI stylist | OpenAI project/key/model and spend cap; real structured-output, incompatible-ID, refusal, timeout, stale-result and styling evaluation cases |
| TASK-005 | Implement the licensed 3DLOOK contract | Product/plan, official API docs, sandbox credentials, sample results, supported capture flow, authentication and retention agreement |
| TASK-006 | Normalize and review 3DLOOK results | Tailor-approved measurement definitions, source/quality mapping, edit provenance, retake versioning and model entitlement; no guessing missing values |
| TASK-007 | Integrate production garment/model assets | Asset rights, GLB variants/material mappings, performance budget and visual validation; preserve current renderer's controls and product state |
| TASK-008 | Operationalize automated and human review | Tailor-approved tolerances, labeled validation set, authorized staff roles, real review queue and 24-hour staffing/overdue policy |
| TASK-009 | Add quote/order/payment workflow | Payment provider, market/tax/shipping/refund decisions; immutable order snapshot, explicit charge, authoritative callback verification and reconciliation |
| TASK-010 | Privacy and production release | Consent, retention/erasure, private storage, monitoring, backups, staff MFA, accessibility/user study and incident owner |

3DLOOK integration must introduce durable capture/job IDs and an outbox/workflow dispatcher before any external asynchronous job is accepted. Inngest remains the planned workflow option; it is not installed as unused scaffolding in this first slice. Vendor callbacks must never bypass ownership or overwrite customer edits.

Before a production catalog can enable checkout, refactor review readiness from the current explicit reference-catalog blockers into a versioned policy supplied only by authoritative server-side catalog/quote/measurement data. Client or LLM flags must never make an order eligible.

Prioritize TASK-002 through TASK-005 next. Product styling, manufacturing tolerances and legal/commercial promises require real owner inputs; an agent must not invent them.

User-directed TASK-011 improves the full human reference without recurring model license fees. It supplies a bundled CC0 body and local garments, with local visual and interaction evidence. It does not close TASK-007: production garment assets, drape/fit validation, supported body coverage and external visual acceptance remain outstanding.

## D-019 admin catalog, commerce and fulfilment slices (specified 2026-09-28)

Implement in this order. Each task card lists its requirements, contracts and verification. The PR-sized breakdown (51 work packages with readiness items, dependencies, sizes, tests and exit criteria) is in [IMPLEMENTATION-PLAN.md](../delivery/IMPLEMENTATION-PLAN.md).

| Task | Scope | Depends on |
| --- | --- | --- |
| [TASK-015](../delivery/TASK-015.md) | Database catalog, importer from today’s data, immutable releases | — |
| [TASK-016](../delivery/TASK-016.md) | Customer runtime on releases: engine v2, draft upgrade, visual binding with golden tests, grounded assistant | 015 |
| [TASK-017](../delivery/TASK-017.md) | Pricing engine and customer price display | 016 |
| [TASK-018](../delivery/TASK-018.md) | Staff roles, MFA, audit, admin shell | 015 |
| [TASK-019](../delivery/TASK-019.md) | Admin structure editor, rules, lists, media | 015, 016, 018 |
| [TASK-020](../delivery/TASK-020.md) | Fabrics, suppliers, pricing admin, commerce settings | 017, 019 |
| [TASK-021](../delivery/TASK-021.md) | Looks (templates), publish workflow, preview, customer gallery | 019, 020 |
| [TASK-022](../delivery/TASK-022.md) | Multi-garment cart | 017, 021 |
| [TASK-023](../delivery/TASK-023.md) | Automated check, customer sign-off, orders and snapshots, post-payment tailor review (D-020), customer orders | 018, 022 |
| [TASK-024](../delivery/TASK-024.md) | Stripe Checkout in test mode, reconciliation | 023 |
| [TASK-025](../delivery/TASK-025.md) | Order desk, supplier assignment, deadlines, tracking, support lookup | 020, 024 |
| [TASK-026](../delivery/TASK-026.md) | Production object storage (blocked on Q-024) | 019 |
| [TASK-027](../delivery/TASK-027.md) | Fabric CSV import/export (should-have) | 020 |

Relationship to the earlier plan: TASK-015 to TASK-021 deliver the **mechanism** of TASK-003. Its data dependency remains: approved supplier fabrics, prices and rules (Q-011). TASK-023 delivers TASK-008 as revised by D-020: an automated check and the customer’s sign-off gate payment, and the tailor queue is an optional post-payment review. Staffing remains open (Q-018). Tailor-approved rules are no longer a payment gate (Q-017 resolved). TASK-023 and TASK-024 deliver TASK-009 in Stripe test mode; the live release remains gated by Q-019. TASK-002 (Replit staging) should run before any hosted demo of the admin panel.

User-directed TASK-012 imports the supplied suit Style and Accents menus as reference seed data. It gives TASK-003 a normalized 434-option starting point, but does not approve supplier ownership, source prices, stock, manufacturing compatibility or public rights. TASK-003 remains open until those commercial and production fields are authoritative.
