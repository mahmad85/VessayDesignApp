# Automated review, optional expert review and payment

Status: proposed detailed contract v0.3, 2026-09-28. v0.2 (2026-09-26) offered an optional human review *before* payment. **D-020 changes this:** the customer owns their measurements and signs off on design and measurements; a passed automated check is enough to pay; an optional tailor review runs *after* payment and before production. Requirements changed by D-020 are marked “(v0.3)”. This file still does not authorise live payment.

## Scope

Phase 1 includes men's two-piece suits, dress shirts and standalone blazers. Keep the customer-facing three steps: Design, Measurements, Review & pay. The automated check, issue resolution, sign-off, the optional tailor-review request and checkout are substeps of step three. Tailor-review tracking happens on the order page after payment.

An automated check is an order-readiness check. It is not proof that body measurements are correct or a substitute for physical fit validation. **The customer owns the measurements they provide (D-020)**: their explicit sign-off, not a tailor approval, authorises production from those values. The language model adds advisory explanations and questions; it cannot invent tolerances, clear a blocking finding, or authorise payment or production by itself.

## Review contract

REV-001: Review MUST operate on a versioned snapshot of the garment configurations, selected measurement revision, quote, supported pattern block, catalog availability, rule-set version and policy version. Persist findings and their provenance. A changed relevant input makes the previous review stale.

REV-002: Run deterministic checks for required selections, allowed combinations, measurement coverage and units, supplier-approved plausibility/tolerance rules, supported garment/body coverage, personalization constraints, price/currency and stock/lead-time requirements. Use AI for bounded interpretation/explanation of notes and contradictions. Unknown or failed required checks cannot be treated as passed.

REV-003 (v0.3): Classify findings as **blocking** (the order cannot be submitted until it is corrected) or **advice** (shown to the customer before sign-off; it never blocks). The “expert review required” class is removed by D-020: manually entered measurements are advice, not an escalation. Customers resolve blocking findings by editing data and re-running the check. Accepting advice is not a bypass for a blocking manufacturing or measurement constraint.

REV-004 (v0.3): Checkout eligibility MUST be computed by the application from current inputs: (a) an automated check that passed for the **current** draft revision, (b) the customer’s explicit sign-off on the design and measurements of that revision (REV-009), (c) an available quote, live availability, and the production reference-only guard. The deterministic checks are required. The AI advisory pass (REV-002) runs when configured. If it is unavailable, that is recorded, and it does not block. No invented AI confidence percentage controls acceptance, and AI output can neither block nor clear a check. Tailor approval is **not** a condition of payment.

REV-005 (v0.3): Customers MUST be offered an optional **tailor review after payment and before production**. It is requested at submission and bound to the submitted snapshot. It opens when payment succeeds. The order cannot be released to production until the review is complete. If the customer changes their draft afterwards, the paid order is unaffected; changes to a paid order go through REV-007.

REV-006 (v0.3): The tailor-review path MUST show the requested 24-hour expectation, measured in elapsed hours from successful payment (the proposed default; confirm under Q-018), plus a received timestamp, the status and the next action. Time spent awaiting the customer’s response is shown separately. No automatic completion or production release happens at the deadline. Staff are alerted before a breach, and the customer is told about a delay. Publishing a firm 24-hour promise requires staffing and ownership capable of meeting it.

REV-007 (v0.3): A tailor decision records the reviewer, timestamp, reviewed snapshot version, notes and outcome: **no changes**, or **changes proposed**. Proposed changes are limited in this scope to measurement values and customer-visible notes. A design change with a price impact is handled manually by staff (Q-029). The customer then either **accepts** the proposal, which creates a tracked amendment snapshot of the paid order (ORD-004), or **keeps their signed-off values**. Both answers complete the review, because the customer owns the measurements. The tailor never silently changes a garment or measurement.

REV-008 (v0.3): Tailor-review decisions and automated-check findings SHOULD be monitored against tailor-labelled cases once real orders exist, to improve the advice rules. Under D-020 this is quality monitoring, not a release gate for payment. A provider’s measurement marketing claims are still not evidence that our checks are reliable.

REV-009 (v0.3, D-020): Submission MUST record the customer’s explicit sign-off: two affirmative, unticked-by-default confirmations (design of every garment; measurements are their own and correct, and garments will be made to them). Each confirmation records the user id, timestamp, statement version, draft revision and measurement version, and is stored in the order snapshot. A sign-off applies only to the exact revision shown; any later edit requires a new sign-off. The final legal wording is subject to Q-032.

## State separation

| State group | Proposed states | Authority |
| --- | --- | --- |
| Automated check (draft, v0.3) | not_run, correction_required, passed, stale | Deterministic application rules; AI adds advice only |
| Tailor review (order, v0.3) | not_requested, awaiting_payment, pending, in_review, awaiting_customer, completed, cancelled | Authorised tailor proposes; the customer decides |
| Checkout/payment | not_started, checkout_ready, payment_pending, succeeded, failed, cancelled, refund_pending, refunded | Server reconciliation with payment provider |
| Fulfillment | not_released, clarification_hold (implemented as `on_hold`), released, in_production, completed (extended in ORDERS-FULFILLMENT.md FUL-003) | Approved operations policy and authorized staff/workflow |

A passed check, customer sign-off, paid status, tailor-review completion and manufacturing release are separate facts. Customer-facing statuses explain the next action. A generic approved boolean must not blur these states.

## Payment contract

PAY-001 (v0.3): Payment MUST begin only after the customer sees and accepts the exact included items, the current total and currency, the relevant delivery terms, and the signed-off revision with a passed automated check (REV-004, REV-009). AI completion alone must not charge a saved card. Use the selected payment provider's hosted/tokenized checkout; raw card data must not be stored in this application.

PAY-002: Create a checkout session server-side, bound to one order, quote and signed-off snapshot version, and to one action identity. Recheck current eligibility, price and availability. Where inventory is constrained, define reservation/expiry behavior before live checkout. Lock the payable snapshot; later edits require a new review and checkout rather than mutating the payable version.

PAY-003: Mark payment successful only after verified provider status, including correct order binding, environment, amount and currency. A browser redirect is not payment proof. Deduplicate provider events and handle out-of-order/late notifications. Retried checkout actions must not produce unintended duplicate charges; reconcile an unknown/pending payment before creating a replacement attempt.

PAY-004: A successful payment MUST show confirmation and a receipt/reference for the paid snapshot. Proposed message: "Payment received. Our tailoring experts may contact you if we need any further details about your order." When tailor review was requested, add: "Your tailor review starts now. Allow up to 24 hours; production begins after it is complete." Do not state production has started until fulfillment release actually occurs.

PAY-005: Post-payment clarifications MUST preserve the paid specification. Material changes to price, fabric, design or measurements require a tracked amendment and explicit customer acceptance. Additional payment requires a new authorized action; price reductions/refunds follow the approved policy. If an order cannot be fulfilled, the operations/refund process must be defined before launch. The experts-may-contact-you message does not authorize silent substitutions or extra charges.

PAY-006: Notify customers when a tailor review proposes a change, is completed, or is delayed, and when payment is confirmed or fails, as appropriate. Use durable, deduplicated notifications containing secure links and minimal personal data. A payment link authenticates and revalidates the current approved quote; an emailed link alone is not permission to charge. Notification delivery failure does not lose the approved case or change payment state.

## Proposed screen copy and behavior

| Surface | Proposed content/action |
| --- | --- |
| Automated checking | Checking your design and measurement details; show actual check states without a fake accuracy score |
| Correction | Name the issue, explain why it matters, and link to the exact field; keep prior values/source visible |
| Advice | Show each advice item with its reason; the customer may still proceed. Advice for manual measurements: "You entered these measurements yourself. We will make your garments to them. Add a tailor review if you would like an expert to check them." |
| Sign-off (v0.3) | Two unticked confirmations: "I have reviewed the design of each garment and want it made as shown." / "These are my measurements. I confirm they are correct and understand my garments will be made to them." (wording subject to Q-032) |
| Tailor review option (v0.3) | "Add a tailor review — after payment, a tailor checks your design and measurements before production. Allow up to 24 hours. If they suggest a change, you decide." |
| Place order | The button states the exact total, e.g. "Place order and pay $934.00" |
| Payment pending | We are confirming your payment. Do not ask the customer to pay again while status is unknown |
| Paid | Receipt/reference, the paid specification, and the expert-contact message; plus the tailor-review message when requested |
| Tailor review pending | "A tailor is reviewing your order. Allow up to 24 hours from payment. Production starts after the review." |
| Changes proposed | Show each proposed value next to the signed-off value, with the tailor's note. Actions: "Accept the tailor's changes" / "Keep my measurements". Either choice completes the review |
| Tailor review complete | "Tailor review complete — your order is ready for production." |

Exact commercial copy and the SLA clock must be accepted by operations before publication. Email is the proposed initial notification channel; SMS/WhatsApp require a separately approved channel/provider and delivery policy. No notifications are sent as part of writing this specification.

## Open dependencies

Merchant registration country, currency, tax/shipping terms, payment provider entitlement, quote/reservation validity, capture/refund policy, and tailor-review staffing/SLA remain unresolved. Approved review rules are no longer a payment gate (D-020). The sign-off wording and the AI data scope are Q-032, and a tailor-review fee is Q-033. Resolve these before the dependent live release, while continuing independent specification work.
