# Screen contracts

Status: draft v0.2. Screen IDs are stable. All routes and button copy are proposed application contracts, not implemented endpoints. Requirements: UX-004 through UX-012.

## Shared screen contract

For every screen, implement idle, loading, success, empty, recoverable error, unauthorized/expired session, and unavailable states where applicable. Preserve saved inputs on navigation and failure. A disabled primary action must explain the missing requirement. One primary action per task area.

| Screen | Content and primary action | Key states and behavior |
| --- | --- | --- |
| S-01 Start/resume | Garment choices, brief description, Start designing; saved drafts if available | Empty history is a normal state. Guest design is proposed; identity is required before live scan/submission unless reviewed otherwise. No mandatory appearance photo |
| S-02 Design consultation | Current garment, conversation, accepted tags, 3D preview, compatible controls, quote state | Greeting, typing, recommending, applying change, saved, conflicting update, no compatible results, AI unavailable, asset unavailable |
| S-03 Option drawer | Named swatches/options, price effect where verified, explanation, Select | Separate hover/temporary preview from accepted selection. Unavailable options explain why. Explore more preserves filters and draft |
| S-04 Measurement introduction | Reason for measurements, data-use summary, provider instructions, Continue with 3DLOOK | Consent unchecked by default; link expiry and device support explained. Manual/tailor alternatives according to approved policy |
| S-05 Capture handoff | Secure link/QR or verified embedded provider flow; return path | Waiting, launched, abandoned, expired, provider unavailable. No assumed provider webcam UI or unsupported photo upload |
| S-06 Processing | Status text and saved-design reassurance | Processing, completed, failed, taking longer, retry/review alternatives. Can leave and resume; no fake percentage |
| S-07 Measurement review | Relevant input fields, source/status, units, body model, Save/confirm measurements | Field selection highlights body path. Validation, dirty changes, missing metric, unknown quality, retake, provider-model unavailable |
| S-08 Order review | Included garments, exact selections, measurement revision, current quote, automated check and findings, design and measurement sign-off, optional tailor-review request | Checking, correction required, passed with advice, stale after edit, AI advisory unavailable; no order for unresolved blockers, a stale check or missing sign-off (D-020) |
| S-09 Order/payment result | Reference, paid or review-pending status, specification, next action | Separate review submission from verified payment. Pending/unknown payment must reconcile before retry; no duplicate charge |
| S-10 Admin catalog | Schema/fabric/options/asset mappings and draft/publish state | Validation errors, unsupported combination, asset missing, published version retained |
| S-11 Tailor review | Paid order snapshot, customer sign-off, measurement sources, check advice, SLA due time, reviewer actions | Pending, in review, awaiting customer, completed, overdue; decisions (no changes or proposed measurement changes) tied to the exact snapshot version; runs after payment and before production (D-020) |
| S-12 Checkout | Current approved snapshot, total/currency, delivery terms, explicit payment action | Revalidate review/quote/stock, pending verification, failed, cancelled, succeeded; hosted/tokenized payment UI |
| S-13 Tailor review tracking | Payment time, requested 24-hour expectation, case status, the tailor’s message and proposed values, and the customer’s accept/keep decision | Pending, awaiting your answer, overdue, completed; production starts only after completion; no automatic completion (D-020) |

S-10 and S-11 are expanded into the admin screens ADM-01 to ADM-19 in [ADMIN-SCREENS.md](ADMIN-SCREENS.md). That file also specifies the D-019 changes to S-01 (look gallery), S-02 and S-03 (cart and prices), S-08 (submission), S-09 and S-13 (customer orders) and S-12 (Stripe checkout).

## Design details

UX-004: S-02 MUST expose only the selected garment's available customization groups. Switching the active garment preserves each garment's choices. Switching its product type previews invalidated choices and asks the customer to accept the impact before destructive removal.

UX-005: Accepted tags MUST be editable and visibly distinct from recommendations. A fabric name maps to the exact fabric record. A broad preference such as dark blue appears as a preference, not a finalized fabric.

A streaming answer may explain recommendations, but a Confirmed label appears only after the server accepts the associated command. The primary action shows what still needs resolution. Recommended construction defaults become selected only through explicit acceptance of the clearly summarized defaults.

## Capture and review details

UX-006: Starting capture MUST preserve the draft and bind the return to a secure capture session. Desktop phone handoff is available if supported by the chosen provider contract; it must not expose account credentials or reusable access to other drafts.

UX-007: Selecting a measurement field MUST highlight the correct anatomical definition on the model or an equivalent accessible diagram. Unselected labels collapse to prevent overlap. Offer front/back/side, zoom/reset controls, and text guidance. Use the complete body for lower-body measurements.

UX-008: Unit changes MUST preserve the canonical value without repeated rounding drift. Field errors explain expected units and the agreed measurement definition. Tailor-defined plausibility checks flag unusual values; they must not silently replace them with averages.

Show source badges such as 3DLOOK estimate, Customer edited, Tailor verified. Never use Verified because the customer viewed the avatar. A measurement edit highlights its difference and creates a new revision on save. Retake must preserve the previous revision for comparison. A new provider result must not silently overwrite edits.

If no provider mesh is available, show a clearly labeled reference mannequin with the measurement paths. Do not present it as the customer's reconstructed body. Whether this fallback satisfies the Phase 1 promise is a product decision under Q-008.

## Review details

UX-009: Review MUST label styling-only garments as Not included. The specification lists supplier fabric code, accepted options, personalization details, units, measurement revision, quote state, and inclusion boundaries.

UX-010: Each review section MUST link to its corresponding editor. A change affecting order meaning invalidates the previous confirmation and, where relevant, quote. Returning to review shows what changed.

UX-011 (v0.3, D-020): Run the automated order check. Display blocking findings with a correction path, and advice without blocking. Require the customer’s explicit sign-off on design and measurements, and offer an optional tailor review that happens after payment and before production. Then provide an explicit **Place order and pay** action only for a current, checked and signed-off revision. Tailor review displays the requested 24-hour expectation from payment, with the agreed delay and awaiting-customer terms, and lets the customer accept a proposed change or keep their own values. Payment and production messages must reflect verified states. [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) owns the full policy and copy.

UX-012: Staff screens MUST use least-privilege roles and distinguish a historical order snapshot from editable catalog/current customer data. Notes and clarifications must be attributable and dated.
