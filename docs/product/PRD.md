# Product requirements

Status: draft v0.2. Proposed details require baseline review. Decisions: D-001 through D-011. Categories and menswear are confirmed; review/payment details remain proposed.

## Product promise

Help a customer choose a manufacturable tailored garment through a welcoming expert conversation and synchronized visual controls, obtain and review body measurements through 3DLOOK, and approve a precise order specification before review-gated payment.

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

Phase 1 garment scope is confirmed: men’s two-piece suits, dress shirts and blazers. Exact menswear pattern blocks and coverage still require tailor definition. The requested review/payment direction is specified in [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md); eligibility rules, SLA operations, provider and market remain open.

## Scope boundaries proposed for Phase 1

Deliver catalog-grounded chat, usable 3D configuration, live provider measurement integration, editable review, persistent drafts, production specification export, automated order checks, optional human review and review-gated checkout. Physical cloth simulation, proprietary body reconstruction, broad international checkout, native mobile apps, voice consultation, and automatic production release are future capabilities unless the user adds them to scope.

The final avatar can show styling context, but unpurchased items must be labeled and excluded from price/specification. The system must not promise that a 3DLOOK body mesh automatically supports garment draping.

## Journey detail

Start with the customer goal, garment/occasion, deadline, budget, climate, colors, comfort, and fit preferences, in an adaptive sequence. Ask only missing questions. Present a small recommended set with explanations and a direct route to all compatible choices. Offer accepted defaults for technical construction decisions. Preserve the customer's final authority over their style.

Move to measurements after configuration completeness. Preserve the design when the customer leaves for capture. Review only measurements relevant to the chosen garments and tailoring protocol. If required data is missing or unreliable, provide the approved manual/tailor fallback and label its provenance.

Review all included garments and accepted measurements. Returning to edit a material choice invalidates the previous review/quote when relevant; it does not destroy unrelated work. Final confirmation must be deliberate. Step three includes the review-mode choice, corrections, current quote acceptance and explicit payment. Automated review does not verify physical fit; unresolved blocking findings route to correction or human review.

## Measures of success

Instrument design-start, design-complete, capture-start, capture-return, measurement-review, order-review, and submission. Track drop-off, time spent, corrections, capture failures, unsupported requests, and mismatches. Use pseudonymous event identifiers, not raw chat or body data.

Targets for conversion, tailoring error, and remake rate require a pilot and supplier agreement. Do not invent percentage accuracy targets. Proposed engineering budgets appear in SECURITY-RELEASE.md and must be measured before adoption.

## Baseline exit

Approve scope; review all key desktop/mobile screens; verify the provider contract; sign off the measurement dictionary and initial asset plan; and map requirements to acceptance scenarios. A draft with open blockers is not a production-ready specification.
