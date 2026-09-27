# Automated review, optional expert review and payment

Status: proposed detailed contract v0.2, 2026-09-26. User requests AI review with corrections before payment and an optional human review path with a 24-hour expectation. Operational and technical details below require baseline review. This supersedes the v0.1 request-only Phase 1 proposal; it does not authorize real payment or application implementation.

## Scope

Phase 1 includes men's two-piece suits, dress shirts and standalone blazers. Keep the customer-facing three steps: Design, Measurements, Review & pay. Review choice, issue resolution, checkout and human-review tracking are substeps of step three.

An automated review is an order-readiness check. It is not proof that body measurements are correct or a substitute for physical fit validation. Rules approved by the tailor determine automatic acceptance eligibility. The language model explains findings and asks clarifying questions; it cannot invent tolerances or issue a final payment/production authorization by itself.

## Review contract

REV-001: Review MUST operate on a versioned snapshot of the garment configurations, selected measurement revision, quote, supported pattern block, catalog availability, rule-set version and policy version. Persist findings and their provenance. A changed relevant input makes the previous review stale.

REV-002: Run deterministic checks for required selections, allowed combinations, measurement coverage and units, supplier-approved plausibility/tolerance rules, supported garment/body coverage, personalization constraints, price/currency and stock/lead-time requirements. Use AI for bounded interpretation/explanation of notes and contradictions. Unknown or failed required checks cannot be treated as passed.

REV-003: Classify findings as blocking error, correction/clarification needed, expert review required, or nonblocking advice. Customers can resolve supported issues by editing data and re-running review. Accepting a warning is not a universal bypass for blocked manufacturing/measurement constraints.

REV-004: Automatic checkout eligibility MUST be computed by an application policy from current verified inputs and resolved findings. Serious measurement inconsistencies, unsupported pattern/body coverage, unresolved ambiguity, missing mandatory provider data, or failed required AI analysis route to correction or expert review. No invented AI confidence percentage controls acceptance.

REV-005: Customers MUST be offered optional human review before payment. Selecting it creates a review case and freezes the submitted revision for the reviewer. The customer can continue editing a new revision, but that revision requires an updated review; the interface must not silently approve it using an older case.

REV-006: The human-review path MUST show the requested 24-hour expectation, a received timestamp, status, and next action. Define whether the promise uses elapsed hours or business hours before release. Proposed default is elapsed hours from a complete submission; requests awaiting customer information are explicitly shown separately. No automatic approval occurs at the deadline. Alert staff before breach and tell the customer about delay. Publishing a firm 24-hour promise requires staffing and ownership capable of meeting it.

REV-007: An expert decision records reviewer, timestamp, reviewed revision, findings and outcome. Corrections are proposed to the customer rather than silently changing their garment or measurements. The customer accepts revisions, receives the current total and explicitly proceeds to payment only after an applicable approval.

REV-008: Automated review and optional human review MUST be evaluated against a tailor-labeled set of cases before customer release. Measure missed blockers, inappropriate escalations and decision consistency by garment/pattern coverage. Select production thresholds and rules with the tailor. A provider's measurement marketing claims are not evidence that our order-review policy is reliable.

## State separation

| State group | Proposed states | Authority |
| --- | --- | --- |
| Review | not_started, checking, correction_required, expert_required, human_pending, awaiting_customer, approved, stale, failed | Application rules and authorized reviewer; AI produces findings only |
| Checkout/payment | not_started, checkout_ready, payment_pending, succeeded, failed, cancelled, refund_pending, refunded | Server reconciliation with payment provider |
| Fulfillment | not_released, clarification_hold, released, in_production, completed | Approved operations policy and authorized staff/workflow |

Review approval, paid status and manufacturing release are separate facts. Customer-facing statuses explain the next action. A generic approved boolean must not blur these states.

## Payment contract

PAY-001: Payment MUST begin only after the customer sees and accepts the exact included items, current total/currency, relevant delivery terms and approved review revision. AI completion alone must not charge a saved card. Use the selected payment provider's hosted/tokenized checkout; raw card data must not be stored in this application.

PAY-002: Create a checkout session server-side, bound to one order/quote/review revision and action identity. Recheck current eligibility, price and availability. Where inventory is constrained, define reservation/expiry behavior before live checkout. Lock the payable snapshot; later edits require a new review and checkout rather than mutating the payable version.

PAY-003: Mark payment successful only after verified provider status, including correct order binding, environment, amount and currency. A browser redirect is not payment proof. Deduplicate provider events and handle out-of-order/late notifications. Retried checkout actions must not produce unintended duplicate charges; reconcile an unknown/pending payment before creating a replacement attempt.

PAY-004: A successful payment MUST show confirmation and a receipt/reference for the paid snapshot. Proposed message: "Payment received. Our tailoring experts may contact you if we need any further details about your order." Do not state production has started until fulfillment release actually occurs.

PAY-005: Post-payment clarifications MUST preserve the paid specification. Material changes to price, fabric, design or measurements require a tracked amendment and explicit customer acceptance. Additional payment requires a new authorized action; price reductions/refunds follow the approved policy. If an order cannot be fulfilled, the operations/refund process must be defined before launch. The experts-may-contact-you message does not authorize silent substitutions or extra charges.

PAY-006: Notify customers when a human review needs input, is approved for checkout, is delayed, or when payment is confirmed/failed as appropriate. Use durable, deduplicated notifications containing secure links and minimal personal data. A payment link authenticates and revalidates the current approved quote; an emailed link alone is not permission to charge. Notification delivery failure does not lose the approved case or change payment state.

## Proposed screen copy and behavior

| Surface | Proposed content/action |
| --- | --- |
| Review choice | Automated order check — resolve any issues and continue to payment; Human expert review — allow up to 24 hours, pay after approval |
| Automated checking | Checking your design and measurement details; show actual check states without a fake accuracy score |
| Correction | Name the issue, explain why it matters, and link to the exact field; keep prior values/source visible |
| Expert required | These details need our tailoring team's review before payment; explain actionable reason |
| Manual pending | Your review has been requested. Allow up to 24 hours. If we need more information, completion may take longer. We will ask for payment after approval |
| Approved | Review complete; show accepted changes and current quote; Continue to payment |
| Payment pending | We are confirming your payment. Do not ask the customer to pay again while status is unknown |
| Paid | Receipt/reference, the paid specification, and the expert-contact message |

Exact commercial copy and the SLA clock must be accepted by operations before publication. Email is the proposed initial notification channel; SMS/WhatsApp require a separately approved channel/provider and delivery policy. No notifications are sent as part of writing this specification.

## Open dependencies

Merchant registration country, currency, tax/shipping terms, payment provider entitlement, quote/reservation validity, capture/refund policy, human-review staffing/SLA, and approved review rules remain unresolved. Resolve these before the dependent live release, while continuing independent specification work.
