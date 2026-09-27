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
| S-08 Order review | Included garments, exact selections, measurement revision, current quote, review mode and findings | Checking, correction required, expert required, human pending, approved, stale, provider failure; no checkout for unresolved blockers |
| S-09 Order/payment result | Reference, paid or review-pending status, specification, next action | Separate review submission from verified payment. Pending/unknown payment must reconcile before retry; no duplicate charge |
| S-10 Admin catalog | Schema/fabric/options/asset mappings and draft/publish state | Validation errors, unsupported combination, asset missing, published version retained |
| S-11 Tailor review | Review snapshot, measurement sources, findings, SLA due time, reviewer actions | Human pending, awaiting customer, approved/declined, overdue; decisions tied to exact revision |
| S-12 Checkout | Current approved snapshot, total/currency, delivery terms, explicit payment action | Revalidate review/quote/stock, pending verification, failed, cancelled, succeeded; hosted/tokenized payment UI |
| S-13 Human review tracking | Received time, requested 24-hour expectation, case status, secure messages and payment-ready action | Awaiting reviewer/customer, overdue, updated revision, approved; no automatic charge |

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

UX-011: Offer automated order checks and optional human review before checkout. Display findings and a correction path, then an explicit Continue to payment action only for a current eligible revision. Human review displays the requested 24-hour expectation with the agreed delay/awaiting-information terms. Payment and production messages must reflect verified states. [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md) owns the full policy and copy.

UX-012: Staff screens MUST use least-privilege roles and distinguish a historical order snapshot from editable catalog/current customer data. Notes and clarifications must be attributable and dated.
