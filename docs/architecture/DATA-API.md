# Data and internal API contracts

Status: draft design v0.2. These are OUR proposed application contracts, not 3DLOOK endpoints. Machine-readable schemas and OpenAPI should be authored from this approved baseline before dependent implementation.

## Persistent entities

| Entity | Key fields and invariants |
| --- | --- |
| Customer | Internal ID, identity subject, preferences; identity provider ID is not the application primary key |
| Role grant | Staff identity, scope, granted by, timestamp; separate customer ownership from staff permissions |
| Outfit draft | Owner/session binding, revision, lifecycle, active garment, timestamps |
| Garment configuration | Draft ID, product schema version, pattern block, selected option IDs, fit preferences |
| Conversation | Draft/garment context, message ID, role, accepted tool outcomes, provider/model/prompt version |
| Catalog versions | Products, options, fabrics, constraints, prices, visual manifests; stable internal IDs |
| Capture session | Customer/draft binding, provider, environment, status, expiry if known, provider reference, consent record |
| Measurement revision | Immutable revision identity and individual values/provenance; selected revision is explicit |
| Asset record | Purpose, storage object key, owner/access scope, source/version, retention state |
| Quote | Currency, exact amounts, price-rule version, configuration revision, validity and availability status |
| Order snapshot | Submission key, accepted configuration/measurements/quote, immutable specification, separate review/payment/fulfillment state |
| Review result/case | Exact input revisions, rules/model versions, findings/severity/source, reviewer, due time, state |
| Checkout/payment attempt | Order snapshot, amount/currency, quote/review versions, idempotency key, provider reference, verified status |
| Notification event | Recipient/customer binding, purpose, linked revision, delivery/deduplication status; minimal payload |
| Job/outbox event | Event ID, job ID, input revision, status, attempt count, provider reference, result/error |
| Audit event | Actor, action, entity/revision, timestamp; minimize personal payloads |

Foreign keys, ownership checks and unique constraints enforce relationships. Orders retain snapshots, not merely live foreign keys to mutable catalog text. Avoid storing all product/order state as an unvalidated JSON blob.

## Command contracts

| Command | Input essentials | Result essentials |
| --- | --- | --- |
| CreateDraft | Supported initial product or goal; guest/account context | Draft ID, ownership session, revision |
| ApplyConfigurationChange | Draft/garment ID, expected revision, action ID, typed option changes | New revision, accepted choices, dependent changes, quote state, missing decisions |
| SendConsultationMessage | Draft/context revision, message ID, text | Streamed explanation; separate validated tool outcomes and committed revisions |
| StartCapture | Draft/customer context, consent reference, selected provider mode | Internal capture ID, supported launch mechanism, status/expiry |
| GetCaptureStatus | Authorized capture ID | Normalized status, result availability, actionable failure |
| SaveMeasurementEdits | Source revision, expected active revision, validated values, action ID | New measurement revision and confirmation state |
| ConfirmMeasurements | Exact revision and required coverage | Approved-for-customer-review status; not automatically tailor verified |
| GetReview | Draft/current revision | Included garments, resolved choices, measurement revision, commercial and completeness state |
| SubmitForReview | Expected draft/measurement/quote revision, selected review mode, action ID | Review snapshot/reference, findings or pending human case |
| ResolveReviewFinding | Review/revision, issue ID, explicit accepted correction or clarification | Revised inputs, review invalidation/recheck, current eligibility |
| CreateCheckout | Current approved review/snapshot, quote, customer acceptance, action ID | Server-created provider checkout reference or actionable rejection |
| ReconcilePayment | Authorized provider event or server retrieval reference | Verified paid/pending/failed state after amount/currency/snapshot validation |

Transport is proposed JSON HTTP endpoints with SSE for consultation streaming. Use explicit JSON schemas/Zod at boundaries. Do not expose privileged provider keys or accept ownership/price assertions from browser input.

## Error semantics

Use stable application error codes: validation_failed, forbidden, not_found, stale_revision, incomplete_configuration, unavailable_option, quote_expired, provider_unavailable, capture_expired, processing_failed and rate_limited. Return readable text plus relevant field/requirement IDs. Authentication expiry routes to recovery without exposing private data.

Revision conflicts return current revision and safe reconciliation information. Retrying an action reuses its action ID; matching repeats return the same result, and conflicting payload reuse is rejected. Store idempotency records durably. Do not report success on an uncommitted or unknown result.

## Schema and contract delivery gate

Before API-dependent coding, add typed schemas, status transition tables, endpoint paths/methods, authorization matrix, example valid/invalid payloads, and contract tests for the assigned slice. These are detailed task deliverables; the current Markdown contract is not an invented complete OpenAPI file.

Database changes require a versioned migration, staged verification, compatibility assessment and restore plan. Use additive migrations where practical. Destructive schema operations require explicit task authorization and a data preservation plan.
