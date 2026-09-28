# Open questions and dependency gates

Status: OPEN unless a dated resolution is recorded. Q-001 and Q-002 are resolved; Q-003 now concerns the detailed requested review/payment flow. Owner names below are roles to assign, not people already committed.

## Product choices to resolve first

| ID | Question | Proposed default | Owner | Blocks |
| --- | --- | --- | --- | --- |
| Q-001 | RESOLVED 2026-09-26: two-piece suit, dress shirt and blazer | User-confirmed D-009 | Product owner | Exact supplier options/assets still required |
| Q-002 | RESOLVED direction 2026-09-26: menswear first | User-confirmed D-010 | Product owner + tailor | Tailor must still define exact supported blocks/body coverage |
| Q-003 | PARTLY RESOLVED 2026-09-28 by D-020: automated check → customer sign-off → payment → optional post-payment tailor review → production | User-confirmed D-020 | Product owner + tailor | Remaining: the 24-hour operational promise (Q-018), the payment contract (Q-019), sign-off wording (Q-032) |
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
| Q-017 | RESOLVED 2026-09-28 by D-020: checkout eligibility = passed deterministic check + customer sign-off; the AI advisory pass is advice only; no tailor-approved rule set is required to take payment. Tailor-labelled evaluation continues as quality monitoring (REV-008) | User | — |
| Q-018 | Post-payment tailor-review staffing, elapsed/business-hour definition (proposed: 24 elapsed hours from payment), overdue handling, reminders, and what happens when a customer never answers a tailor proposal | Operations owner | Publication of a firm 24-hour promise |
| Q-019 | Merchant entity/country, currency, payment provider, quote/reservation expiry, tax/shipping/refund terms | Product + operations owner | Live checkout |
| Q-020 | Accept Better Auth self-hosting or retain Clerk; assign auth maintenance/email provider | Product + technical owner | Authentication implementation |
| Q-021 | Accept Node recommendation or choose FastAPI based on team/custom-model plans | Technical owner | Architecture baseline |
| Q-022 | Transactional notification provider, contact preferences and delivery recovery | Operations + technical owner | Manual-review/payment notification release |
| Q-023 | Provenance, trademark/brand treatment and permission to publish the supplied Hockerty menu images and extracted option data | Product owner + rights owner | Public release of supplied reference assets |

## D-019 dependencies (admin catalog, commerce and fulfilment), added 2026-09-28

The development placeholders in `commerce_settings` (currency `USD`, ship-to `US`, 7-day quote validity, delivery fee 0) belong to Q-019. They are not commercial decisions.

| ID | Decision/evidence needed | Proposed default | Owner | Blocks |
| --- | --- | --- | --- | --- |
| Q-024 | Production object storage for admin-uploaded catalog media: provider (Replit App Storage per ADR-003, or S3-compatible), approval of the SDK dependency, backup/restore, and whether uploaded images must have EXIF metadata stripped (no image-processing dependency is planned) | Replit App Storage behind the `StorageProvider` adapter; local driver in development only | Technical owner | TASK-026; production admin uploads |
| Q-025 | Staff session lifetime, re-authentication for sensitive actions, and the staff account recovery runbook (lost authenticator) | Same 7-day session as customers, TOTP plus backup codes, owner-run CLI recovery after identity check | Product + technical owner | Production staff access (AUTH-004/005) |
| Q-026 | Tailor review of imported construction choices: the preserved `relaxed` jacket fit for suits and blazers, the blazer availability subset, and the “Mix & match fabrics” choice, which has no per-part fabric support | Keep today’s behaviour, flagged | Tailor + catalog owner | Live catalog release |
| Q-027 | Supplier contracts and dispatch: how production sheets reach suppliers, supplier job references, lead-time commitments, and whether a supplier portal is needed | Manual dispatch of the printed or JSON production sheet | Operations owner | Production fulfilment at scale |
| Q-028 | Can one cart hold garments for more than one person (several measurement profiles)? | No: one measurement profile per draft | Product owner | Gifting and group orders |
| Q-029 | Post-payment amendments, customer cancellation after payment, unfulfillable orders and refund operations (PAY-005 detail) | Handled manually by staff in Stripe, with the order flagged `needs_attention` | Operations + product owner | Live payment release |
| Q-030 | Confirm the fulfilment tracking statuses and customer labels (ORDERS-FULFILLMENT FUL-003/004), the operations timezone, and the customer ETA policy | As proposed in FUL-003/004; ETA shown only when staff set it | Operations owner | Customer release of order tracking |
| Q-031 | Are accessories (ties, bow ties, pocket squares, braces, belts, socks, shoes) sold items or styling-only? What size data do shoes and belts need? | Sold as `accessory` lines. Size capture is not built, so shoes and belts stay reference-only until sizes are specified | Product + catalog owner | Selling accessories |
| Q-032 | (D-020) Final legal wording of the design and measurement sign-off statements and how they relate to remake/alteration terms (Q-013). Also: may the AI advisory pass receive body measurement values (a privacy notice and consent change, SEC-003)? | Proposed copy in REVIEW-PAYMENTS.md, versioned `signoff-v1`. The AI receives the design and the measurement source/completeness only, **never values** | Product owner + privacy/legal owner | Customer release of ordering; any measurement-aware AI advice |
| Q-033 | (D-020) Is the post-payment tailor review free or a paid add-on? If paid, what is the price, and is it refundable? | Free (no line item) | Product owner | Charging for tailor review |
