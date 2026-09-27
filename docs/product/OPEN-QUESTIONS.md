# Open questions and dependency gates

Status: OPEN unless a dated resolution is recorded. Q-001 and Q-002 are resolved; Q-003 now concerns the detailed requested review/payment flow. Owner names below are roles to assign, not people already committed.

## Product choices to resolve first

| ID | Question | Proposed default | Owner | Blocks |
| --- | --- | --- | --- | --- |
| Q-001 | RESOLVED 2026-09-26: two-piece suit, dress shirt and blazer | User-confirmed D-009 | Product owner | Exact supplier options/assets still required |
| Q-002 | RESOLVED direction 2026-09-26: menswear first | User-confirmed D-010 | Product owner + tailor | Tailor must still define exact supported blocks/body coverage |
| Q-003 | Review/payment details for requested dual path | Automated checks then explicit checkout; optional human review before payment | Product owner + tailor | Eligibility policy, 24-hour operational promise, payment contract |
| Q-004 | Target market, currency, language, brand, and delivery service area? | One market/currency and English | Product owner | Commercial values and visual design |

Garment categories and menswear are settled. Detailed review/payment policy, authentication choice and market remain open. Draft work can proceed with visible assumptions; it must not turn proposed policies into accepted commitments.

## Provider and production dependencies

| ID | Required evidence or decision | Owner | Gate |
| --- | --- | --- | --- |
| Q-005 | Contracted 3DLOOK product/plan, API/SDK entitlement, sandbox credentials and docs | Product owner + vendor contact | Live integration implementation |
| Q-006 | Session initiation, capture flow, result retrieval, status semantics, webhook/poll availability and authentication | Integration lead + vendor | Integration contract approval |
| Q-007 | Exact measurement dictionary, units, quality indicators, revision/retake behavior | Tailor + integration lead | Measurement mapping |
| Q-008 | Avatar export format, license, scale, orientation, topology, landmarks, rig/morph availability | 3D lead + vendor | Personalized avatar implementation |
| Q-009 | Capture support for browsers/devices, cross-device handoff, accessibility limitations, abandonment and restart | UX lead + vendor | Capture UX approval |
| Q-010 | Provider retention, deletion, subprocessors and applicable processing agreement | Product owner + privacy owner | Real customer capture release |
| Q-011 | Real fabrics, supported construction, availability, supplier codes and prices | Catalog owner + tailor | Live catalog release |
| Q-012 | Required measurements and per-measurement production tolerances | Tailor | Production-readiness decision |
| Q-013 | Alterations, remakes, review workflow, delivery estimates and quote expiry | Operations owner | Commercial release |
| Q-014 | Real garment meshes, texture rights, body variants and construction asset coverage | 3D lead | Visual acceptance |
| Q-015 | Approval or changes to ADR-001 through ADR-009 | Technical owner + product owner | Architecture baseline |
| Q-016 | Retention durations, backup recovery targets and operational ownership | Product owner + technical owner | Production release |

## Working rules

Unknown vendor behavior is not an implementation detail an agent may guess. Use verified vendor examples once available. Public claims about scan accuracy are not the application's production accuracy acceptance criteria. FitXpress documentation must not be assumed to describe Mobile Tailor.

Resolve a blocker by recording evidence, date, decision, owner, and affected documents. Mark superseded assumptions explicitly. A blocked integration does not prevent work on approved catalog, UX, or domain specifications.

If provider access only supports dashboard/CSV workflows, do not silently replace the agreed integrated experience with manual transfer. Present that as a scope decision, or obtain the necessary integration access.

## New v0.2 dependencies

| ID | Decision/evidence needed | Owner | Blocks |
| --- | --- | --- | --- |
| Q-017 | Automatic checkout eligibility, reviewed rule set, escalation conditions and evaluation results | Tailor + product/technical owner | Automated review release |
| Q-018 | Human-review staffing, elapsed/business-hour definition, overdue/awaiting-customer handling | Operations owner | Publication of a firm 24-hour promise |
| Q-019 | Merchant entity/country, currency, payment provider, quote/reservation expiry, tax/shipping/refund terms | Product + operations owner | Live checkout |
| Q-020 | Accept Better Auth self-hosting or retain Clerk; assign auth maintenance/email provider | Product + technical owner | Authentication implementation |
| Q-021 | Accept Node recommendation or choose FastAPI based on team/custom-model plans | Technical owner | Architecture baseline |
| Q-022 | Transactional notification provider, contact preferences and delivery recovery | Operations + technical owner | Manual-review/payment notification release |
| Q-023 | Provenance, trademark/brand treatment and permission to publish the supplied Hockerty menu images and extracted option data | Product owner + rights owner | Public release of supplied reference assets |
