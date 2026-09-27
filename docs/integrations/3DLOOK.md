# Phase 1 integration: 3DLOOK

Status: draft integration contract. Provider selection: USER CONFIRMED (D-004). Product choice: Mobile Tailor PROPOSED. Contract status: NOT VERIFIED. Public-source review: 2026-09-26. Requirements INT-001 to INT-005.

Connection status (2026-09-28, D-017): the public SAIA Mobile Tailor widget capture path is connected — `src/integrations/3dlook.ts`, `src/components/saia-measurement-widget.tsx`, `src/app/api/measurements/saia/*`. It embeds 3DLOOK's own official widget script and verifies the result `postMessage`'s origin and iframe source before accepting it; results save as an unverified, review-required draft and are never treated as checkout-authoritative until the customer confirms. The paid single-use scan (Stripe entitlement/credit ledger, `src/lib/scan-service-policy.ts`, `src/app/api/scan-service/*`) is ported but stays inert: it fails closed with 503 before ever creating a Stripe charge, because the private single-use scan-authorization capability this contract still requires from 3DLOOK (see INT-002 and the failure matrix) has not been supplied. The acceptance gate below is unchanged and not yet met by either path.

## Publicly established and not yet established

Mobile Tailor is presented for made-to-measure use. Its public FAQ describes guided capture through its scanning link, excludes uploading existing photos in that flow, and says API access is included in some plans. Its pricing page distinguishes widget offerings and API/SDK entitlement. Public material also describes 3D model export.

These statements do not establish contracted endpoints, authentication, callbacks, response fields, scan limits, retries, avatar rigging, retention commitments, or a custom capture interface for this application. FitXpress and Mobile Tailor have different positioning; do not import FitXpress guarantees into this contract.

## Evidence request before implementation

Obtain official partner API/SDK documentation; sandbox access; entitlement confirmation; supported widget/link/SDK modes; session and customer identity binding; example successful and failed results; field dictionary and units; capture quality indicators if provided; result delivery and polling limits; rate/concurrency limits; retry/billing semantics; deletion procedure; supported browsers; and one legally usable representative avatar export.

Record version/date and source for each. Test entitlement in the contracted environment. Do not include credentials or private partner docs in a public repository.

## Application-owned contract

INT-001: Integrate through a MeasurementProvider adapter returning internal capture identity, normalized status, standardized measurement values/provenance, and optional model references. Define the adapter according to verified capabilities; do not pretend missing provider methods exist.

Internal normalized states proposed: created, awaiting_capture, processing, ready, failed, expired, cancelled. The adapter maps actual provider states; it must not assert distinctions the provider cannot report. Unsupported/unknown status becomes an explicit indeterminate state with a recovery path.

INT-002: Bind sessions and results to the authorized customer and intended capture revision. Verify callback authenticity if supported; otherwise retrieve authoritative results server-to-server. Use idempotent processing and persisted provider references. Retrying session creation or scans may incur charges; use verified vendor semantics, not blind automatic retries.

INT-003: Follow the contracted guided capture flow. A personal styling photo must not be used as measurement input in place of required live capture. Design return/resume behavior around provider capabilities. Never promise that a generic browser camera frame is equivalent to the vendor's validated capture process.

INT-004: Map provider metrics only after comparing anatomical definitions, units, required posture and garment applicability with the tailor's dictionary. Preserve original results separately from user edits. Missing quality data remains unknown. Provider marketing accuracy claims do not remove the need for garment-specific validation.

INT-005: Treat body-model output as a versioned asset with a documented purpose and license. Verify format, scale, axes, mesh quality, landmarks, topology, textures and possible rig/morph information. Conversion to GLB may prepare it for display, but does not add garment draping, reliable measurement-driven deformation or face likeness.

## Proposed experience boundary

The application owns preparation, consent, secure handoff, processing status, review, manual corrections and final order specification. 3DLOOK owns the verified capture/reconstruction process. The exact embedded versus linked boundary is gated by the vendor contract.

Keep raw photo transfer/retention outside the application where the contracted flow allows. If our backend must relay images, document encrypted storage, limited access and deletion separately. Do not copy FitXpress deletion claims into a Mobile Tailor policy.

## Failure matrix

| Failure | Required response |
| --- | --- |
| No API entitlement | Block API integration and resolve plan/scope; no invented endpoints |
| Capture unsupported on device | Explain verified device requirements and approved alternative |
| Link expires or user abandons | Preserve draft and old session; offer supported restart |
| Rate limit/provider outage | Persist state, bounded backoff where safe, clear retry message |
| Result arrives twice/out of order | Deduplicate by provider job/event identity and capture revision |
| Required metric absent | Block measurement completeness or request approved manual/tailor value |
| Model cannot render | Show labeled reference fallback only if product-approved; preserve numeric results |
| Deletion requested | Follow verified provider procedure and record outstanding/completed status |

## Integration acceptance gate

Demonstrate one authorized sandbox capture returning valid mapped results, one failure/retry path, correct ownership, safe duplicate handling, supported return/resume, and a representative model imported into the viewer. Verify scan charges/limits and deletion procedure. A mock implementation cannot close this gate.

## Primary references

- [Mobile Tailor](https://3dlook.ai/mobile-tailor/)
- [3DLOOK pricing and product entitlements](https://3dlook.ai/pricing/)
- [Made-to-measure offering](https://3dlook.ai/mobile-tailor/for-made-to-measure/)
- [Body model export description](https://3dlook.ai/content-hub/body-measurement-app-for-clothing/)

Public references are a dated research snapshot. Replace unresolved details with the contracted documentation and verified results; do not guess endpoint names from these pages.
