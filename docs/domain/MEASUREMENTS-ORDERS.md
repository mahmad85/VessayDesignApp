# Measurement and order semantics

Status: proposed v0.2. Requirements MEAS-001 to MEAS-006 and ORD-001 to ORD-005.

## Measurements

MEAS-001: Each measurement MUST have a canonical definition: identifier, anatomical path, straight/along-surface/circumference method, posture, unit, precision, relevant pattern blocks and garments, provider mapping, and manual instructions. Similar names are not sufficient evidence of equivalence.

MEAS-002: Store a canonical numeric value in millimeters using suitable exact precision, plus original value/unit, source, capture ID, timestamp, provider/version, and verification status. Display conversions must not accumulate rounding. The final precision policy requires tailor approval.

MEAS-003: Distinguish body measurement, comfort/fit allowance, desired garment length and finished garment dimension. Requesting a relaxed fit changes the fit/construction specification, not the recorded body circumference.

MEAS-004: Provider results, customer corrections and tailor verification MUST be versioned. Preserve provenance for individual values. Do not infer confidence values; missing vendor quality data remains unknown. A human confirmation flag is not an independently measured accuracy claim.

MEAS-005: The application MUST map only required available metrics. Missing values trigger approved manual/tailor collection or a blocked readiness state. Unsupported body/pattern coverage must be communicated before charging for a scan where feasible.

MEAS-006: Personalization photo, measurement capture, provider mesh and illustrative mannequin MUST remain separate data concepts. Changing skin tone or uploaded appearance photo must not alter measurements. Editing values must not pretend to recompute a provider mesh without a validated deformation/reconstruction method.

## Measurement mapping worksheet

Complete one row per production metric before integration approval: internal ID; supplier definition; garment/pattern applicability; vendor field; vendor definition; unit; transform; validation bounds; required/optional; quality flag; fallback; manual method; example fixture; approving tailor. This draft deliberately supplies no invented vendor field names.

## Orders

ORD-001: Submission MUST create an immutable snapshot containing garment components, catalog/schema versions, supplier references, all selected options, personalization text, measurement profile/revision, quote/commercial state, and visual manifest version. Personal body photographs need not be embedded in the production specification.

ORD-002: The same submission action MUST produce at most one order request. Retry after a timeout returns the original result. Refreshing a success page must not create an order.

ORD-003 (v0.3, D-020): Automated check, tailor review, payment and fulfillment MUST have separate state machines. The flow is: automated check and corrections, then the customer’s explicit sign-off on design and measurements, then payment, then an optional tailor review (requested at submission), then release to production. Blocking findings must be corrected before submission. The customer owns their measurements, so a tailor proposal is accepted or declined by the customer. See [REVIEW-PAYMENTS.md](REVIEW-PAYMENTS.md) for lifecycle, SLA, payment eligibility and amendment requirements.

ORD-004: A post-submission change MUST create a revision/amendment for review. It must not rewrite an already accepted production specification. Capture who changed what and when.

ORD-005: Export a readable specification and structured data from the same snapshot. The export must match the review screen. Styling-only accessories are excluded. Tailor notes are separate from customer-selected options unless explicitly accepted as a change.

## Fit validation gate

The tailor sets per-measurement tolerances and the pilot protocol. Compare provider outputs with consistent reference measurements across the intended body/pattern coverage. Record errors, repeatability, missing fields and capture failures. Do not equate a marketing percentage with acceptable jacket shoulder, sleeve or trouser fit.
