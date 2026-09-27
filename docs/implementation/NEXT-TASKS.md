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

User-directed TASK-012 imports the supplied suit Style and Accents menus as reference seed data. It gives TASK-003 a normalized 434-option starting point, but does not approve supplier ownership, source prices, stock, manufacturing compatibility or public rights. TASK-003 remains open until those commercial and production fields are authoritative.
