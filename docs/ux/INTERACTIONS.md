# Interaction and failure rules

Status: proposed v0.2. Requirement IDs UX-013 to UX-018.

## Canonical changes

UX-013: A catalog click, accepted AI suggestion, tag edit, and review edit MUST call the same server-side configuration operation. The response includes the committed revision, quote status, selected options, and unresolved requirements. All views update from that response.

Temporary swatch preview is local and explicitly distinguishable. The accepted design changes only after a successful response. While saving, show Saving; on failure show Not saved with Retry. Do not navigate past an unsaved required change without a clear choice.

UX-014: Commands MUST include the revision they were based on. If the revision is stale, reload current state and explain the conflict. Do not silently overwrite a newer customer choice. The model may regenerate advice using the current configuration.

## Decision table

| Event | Required behavior |
| --- | --- |
| Customer supplies garment, occasion, climate and color in one message | Extract all supported preferences; ask only the most useful missing question |
| Recommendation exceeds budget or deadline | Explain conflict using verified data; offer feasible options if available |
| No matching catalog options | Explain which constraints conflict; ask which to relax; never invent a fabric |
| Fabric changes | Revalidate product compatibility, options, availability, quote and visualization mapping |
| Product category changes | Retain transferable preferences; present incompatible selections before clearing |
| User edits while AI response is pending | Commit direct action normally; old AI actions require revision revalidation |
| Duplicate send/submit/retry | Use action identity and idempotent processing; show the same result |
| Network disconnects | Keep unsent text and last saved configuration; indicate reconnection state |
| User returns after a long pause | Resume saved state; refresh stock/quote validity; request review of affected choices |
| Camera permission denied | Explain permission recovery or offer the approved alternate path; preserve design |
| Scan abandoned | Keep design and session history; permit supported restart; do not assume a free retry |
| Provider completion arrives after retake | Associate result with its own capture revision; do not replace active selection silently |
| Measurement changed after review | Invalidate measurement approval/review state; preserve original order if already submitted |
| Browser cannot render 3D | Show supported reference views and all configuration controls; disclose reduced visualization |

## Conversation behavior

UX-015: Use short, welcoming responses. Explain one decision at a time, with a recommended set of two or three options and an Explore more route. Product names and technical terms have plain-language explanations. Do not flatter every selection or pressure the customer into an upgrade.

Suggestions include why they match the customer's stated needs and material trade-offs supported by catalog metadata. Keep preference rules adjustable; do not convert stereotypes about age, skin tone, or occasion into requirements.

## Form behavior

UX-016: Trim insignificant whitespace in ordinary text; preserve intentional personalization text after an explicit preview. Validate permitted character sets, placement, maximum length, and price against the catalog. No arbitrary monogram limit may be assumed until the supplier defines one.

Use explicit cm/in controls and localized numeric parsing once locale is selected. Reject nonnumeric/negative measurements; handle blank as missing. Measurement-specific ranges and precision are supplied by the approved protocol. Show inline errors plus an error summary for step submission.

## Recovery and confirmations

UX-017: Undo is available for supported recent draft edits by issuing a new validated command, not restoring stale storage blindly. Ask before deleting a garment with configured choices. Routine navigation is reversible and should not trigger confirmation dialogs.

UX-018: Expired sign-in must offer reauthentication and return to the intended screen. Secure draft ownership must be re-established before showing private data. Guest-to-account transfer must preserve draft identity and verify ownership rather than trusting a client-supplied customer ID.

## Review and payment interactions

A passed check and the customer’s sign-off are invalidated by any relevant change to garments, measurements, quote or availability, and must be repeated (D-020). A pending checkout locks its payable snapshot; reconcile it before starting a replacement attempt. A post-payment tailor review works on the paid snapshot. Later draft edits do not change a paid order; only the customer’s acceptance of a tailor proposal creates an amendment. AI cannot clear mandatory blockers, approve an order or charge a customer. Tailor-review and payment notifications link to authenticated current state. See [REVIEW-PAYMENTS.md](../domain/REVIEW-PAYMENTS.md).
