# Implementation status — foundation v0.1

Date: 2026-09-26. Authorization: user said “Let’s go ahead your proposal to start building.” This supersedes the previous no-build instruction. The source includes the v0.2 target specifications with this implementation overlay.

## Current release boundary

Runnable and locally verified customer-journey foundation; **not published to Replit and not approved for real customer orders**. Replit is still the deployment target. No alternative host was substituted. The Replit integration is not connected in this session.

| Capability | Current implementation | Outstanding work |
| --- | --- | --- |
| Three-step design/measure/review journey | Implemented | Representative user testing and final brand |
| Garment categories | Men's suit, shirt and blazer | Tailor-approved construction schemas; multiple garments per cart |
| Catalog | Eight reference fabrics plus 434 supplied suit Style/Accents options normalized by jacket, pants and vest (TASK-012) | Approved supplier ownership, stock, prices, compatibility, asset rights and publish/version workflow |
| Configuration | Server-owned aggregate, shared validated commands, revisions, category-reset consent, action receipts | Per-garment saved configurations and production catalog version linkage |
| Consultation | Guided mode and real OpenAI adapter code; suggestions require explicit acceptance | API key/model, live behavior evaluations, streaming UX, usage monitoring and consent copy |
| 3D design | Bundled CC0 anatomical human GLB, local suit/shirt/blazer surfaces, and material/construction controls; no recurring model license fee (TASK-011) | Production garment assets, cloth/fit validation, verified model output from 3DLOOK |
| Appearance image | Removable local image reference | Face mapping is not implemented or promised |
| Measurements | Manual editing, cm/in switch, source marker, snapshots, confirmation, measurement paths | Live 3DLOOK capture, consent, authenticated result handling, metric mapping, quality and override provenance |
| Automated review | Deterministic completeness and readiness checks; payment fails closed | Tailor-approved tolerances, live commercial context and validation against labeled cases; AI explanations can supplement those rules |
| Human review | Clearly unavailable; no case is falsely submitted | Staff queue, roles, SLA, messaging, approval and overdue handling |
| Checkout | Server rejects every reference-catalog draft | Provider selection, immutable quote/order, stock recheck, explicit payment, webhook verification/reconciliation |
| Identity | Better Auth, database sessions, verification, password reset code, sign-in/out, guest transfer | Live mail validation, account erasure lifecycle, staff roles/MFA and security review |
| Persistence | PostgreSQL production adapter; PGlite development/testing | Hosted Postgres validation, backup/restore and autoscale pool validation |
| Operations | Lockfile, scripts, lint/types/tests/build, readiness endpoint, CI definition | Published staging, monitoring, retention, incident owner and load measurements |

One active draft is stored per owner. An existing account draft takes precedence during sign-in; an unrelated guest draft is not overwritten or silently merged. A multi-draft library and explicit merge UX are follow-up work.

## Important data behavior

- Guest ownership uses a random, HTTP-only cookie; only its hash identifies the owner in draft rows. Account identity comes from Better Auth's verified session, never from a client-supplied owner ID.
- Draft edits and command receipts commit within one database transaction. An expected revision prevents stale overwrites. Revisions preserve the previous accepted snapshot.
- Conversation and selections are saved on the server. OpenAI receives catalog/design context and conversation text only when configured. Raw measurement field values and appearance images are not included in the assistant payload. Customers could still type personal data into conversation; live release needs the approved notice and retention policy.
- Appearance photos are local object URLs. Closing the tab clears them; they are not included in draft exports.
- Manual values are customer-entered, not verified by confirming or viewing the mannequin. Reference geometry never morphs into a claimed accurate body from those values.
- No raw customer data is intentionally logged. Test data is synthetic. Production retention and erasure are release gates; this preview must not be used to collect real customer measurements yet.

## Architecture debt deliberately kept visible

No database-backed supplier catalog, transactional external-job outbox, Inngest worker, object-storage adapter, staff UI, payment integration, account deletion or vendor callback is claimed complete. Those are bounded next tasks on the same codebase. They were not replaced by dummy successful adapters.

The conversation currently returns a completed structured reply; streaming is still pending. The current model remains a reference even if a photo is added. Review checks are deterministic, not an AI-certified fit assessment.

## Human reference update — 2026-09-27

[TASK-011](../delivery/TASK-011.md) replaces the primitive figure with a complete anatomical human mesh, including facial features, hair, fingers and feet. Clothing uses continuous sleeves, fitted jacket/shirt surfaces, actual option-dependent details, shaped trousers and shoes. Measurement mode uses the same generic body with shorts and revised annotation positions. The 320px view reserves space so camera buttons do not cover the feet.

Source assets, CC0 license, pinned commit, offline build and model manifest are included. The model is served from the application; it has no subscription, royalty or external runtime model service. No new dependencies or migrations were introduced. Local verification is recorded in the task and test evidence. Customer likeness, personal body shape, cloth physics, real-device performance and production acceptance remain unverified; no release or external approval is claimed.

## Supplied suit customization seed — 2026-09-27

[TASK-012](../delivery/TASK-012.md) adds a reproducible seed generator for the supplied suit Style and Accents exports. The generated seed contains 434 choices with stable IDs and the supplied jacket, pants and vest hierarchy. Direct choices are validated server-side, saved in the existing draft revision, and selected mapped fields continue to drive the 3D reference.

Source prices are retained only as unapproved reference metadata and do not appear in the customer flow or make checkout eligible. The copied thumbnails are isolated as reference assets. Supplier ownership, availability, compatibility, manufacturing interpretation, terminology review and publication rights remain unverified.
