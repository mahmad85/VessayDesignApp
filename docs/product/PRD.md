# Product requirements

Status: draft v0.2. Proposed details require baseline review. Decisions: D-001 through D-011. Categories and menswear are confirmed; review/payment details remain proposed.

## Product promise

Help a customer choose a manufacturable tailored garment through a welcoming expert conversation and synchronized visual controls, obtain and review body measurements through 3DLOOK, and explicitly sign off on a precise order specification and on their own measurements before payment. An automated check guards payment, and an optional tailor review follows payment before production (D-020).

Success requires confidence in what is being ordered, consistency between every interface, and usable production data. A realistic avatar is an illustration, not evidence of measurement accuracy or physical fit simulation.

## Users

Customer: selects garments, asks for advice, controls preferences, reviews measurements and order details. Tailor/reviewer: verifies measurements and production specifications. Catalog administrator: maintains fabrics, options, rules, pricing references, and visualization mappings. Support role: access limited to required assistance, without automatic access to raw body photos.

Age does not determine fashion preferences. Use readable interfaces and optional guidance for all customers. Do not infer pattern family, identity, or garment preferences from a photograph.

## Scope and requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| FR-001 | The three-step journey MUST persist and resume a customer draft | Reload/session recovery scenario |
| FR-002 | Conversation and direct controls MUST update one canonical configuration | Chat/swatch synchronization scenario |
| FR-003 | Each selected option MUST resolve to a valid catalog ID and compatible product schema | Compatibility checks |
| FR-004 | The assistant MUST extract already supplied preferences and ask for missing decisions | Multi-intent conversation evaluation |
| FR-005 | Suggestions MUST remain distinguishable from accepted selections | Suggested/selected state inspection |
| FR-006 | Step advancement MUST check required decisions; accepted defaults count, unaccepted suggestions do not | Step-gate scenarios |
| FR-007 | Phase 1 MUST use 3DLOOK for live automatic measurement, through a verified integration | External contract and trial evidence |
| FR-008 | Measurement review MUST allow edits, source visibility, and guided anatomical highlighting | Field/model interaction and revision evidence |
| FR-009 | Review MUST show included items, resolved design options, measurement revision, and commercial status | Review/specification parity |
| FR-010 | Submission MUST create one immutable specification snapshot per explicit submit action | Idempotency and snapshot checks |
| FR-011 | An authorized admin MUST be able to maintain catalog data and review order requests | Staff-role scenarios |
| FR-012 | Customer photos MUST be optional for appearance personalization and separate from measurement capture | Skip/remove and purpose checks |
| FR-013 | An authorised admin MUST define the product hierarchy, lookup-driven fabric metadata, rules and a cost at every hierarchy level, and publish them as versioned releases (D-019) | AC-34, AC-35, AC-36 |
| FR-014 | Customers MUST be able to start from admin-defined showcase looks and customise them, with additive live pricing broken down by category (D-019) | AC-36, AC-37 |
| FR-015 | A draft MUST hold several garments that are configured, priced and reviewed together (D-019, CAT-004) | AC-38 |
| FR-016 | Orders MUST be submitted only after a passed automated check and the customer’s explicit sign-off, then paid (Stripe). Tailor review, when requested, and fulfilment follow as separate tracks, with tailor and support staff screens (D-019, D-020) | AC-25, AC-26, AC-39, AC-40, AC-46 |
| FR-017 | Staff MUST manage suppliers (name, address, primary and secondary contacts), assign order items to suppliers with deadlines that can be updated, and maintain customer-visible tracking status (D-019) | AC-41, AC-44 |

FR-013 to FR-017 are refined in [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md), [PRICING.md](../domain/PRICING.md) and [ORDERS-FULFILLMENT.md](../domain/ORDERS-FULFILLMENT.md). Live payment, real catalog data and staffing remain gated (Q-011, Q-018, Q-019, Q-024 to Q-033). Q-017 is resolved by D-020.

Phase 1 garment scope is confirmed: men’s two-piece suits, dress shirts and blazers. Exact menswear pattern blocks and coverage still require tailor definition. The requested review/payment direction is specified in [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md); eligibility rules, SLA operations, provider and market remain open.

## Scope boundaries proposed for Phase 1

Deliver catalog-grounded chat, usable 3D configuration, live provider measurement integration, editable review, persistent drafts, production specification export, automated order checks with explicit customer sign-off, checkout, and an optional post-payment tailor review before production (D-020). Physical cloth simulation, proprietary body reconstruction, broad international checkout, native mobile apps, voice consultation, and automatic production release are future capabilities unless the user adds them to scope.

The final avatar can show styling context, but unpurchased items must be labeled and excluded from price/specification. The system must not promise that a 3DLOOK body mesh automatically supports garment draping.

## Journey detail

Start with the customer goal, garment/occasion, deadline, budget, climate, colors, comfort, and fit preferences, in an adaptive sequence. Ask only missing questions. Present a small recommended set with explanations and a direct route to all compatible choices. Offer accepted defaults for technical construction decisions. Preserve the customer's final authority over their style.

Move to measurements after configuration completeness. Preserve the design when the customer leaves for capture. Review only measurements relevant to the chosen garments and tailoring protocol. If required data is missing or unreliable, provide the approved manual/tailor fallback and label its provenance.

Review all included garments and accepted measurements. Returning to edit a material choice invalidates the previous check, sign-off and quote when relevant; it does not destroy unrelated work. Final confirmation must be deliberate. Step three includes the automated check, corrections, the customer’s explicit sign-off on design and measurements, the optional post-payment tailor-review request, acceptance of the current quote and explicit payment (D-020). The customer owns the measurements they provide. The automated check does not verify physical fit. Blocking findings must be corrected before submission. Advice never blocks.

## Measures of success

Instrument design-start, design-complete, capture-start, capture-return, measurement-review, order-review, and submission. Track drop-off, time spent, corrections, capture failures, unsupported requests, and mismatches. Use pseudonymous event identifiers, not raw chat or body data.

Targets for conversion, tailoring error, and remake rate require a pilot and supplier agreement. Do not invent percentage accuracy targets. Proposed engineering budgets appear in SECURITY-RELEASE.md and must be measured before adoption.

## Baseline exit

Approve scope; review all key desktop/mobile screens; verify the provider contract; sign off the measurement dictionary and initial asset plan; and map requirements to acceptance scenarios. A draft with open blockers is not a production-ready specification.
