# Decisions and assumptions

Status: v0.2 target baseline with authorized foundation implementation overlay. Date: 2026-09-26. See D-012 and ADR-010.

## User-confirmed decisions

| ID | Decision | Evidence | Consequence |
| --- | --- | --- | --- |
| D-001 | The initial implementation must grow into the production product | User rejected throwaway prototype work | Use real domain boundaries, persistence, tests, and versioned contracts |
| D-002 | Deploy the application on Replit | User explicitly selected Replit | Design portable Node application and externalized durable state |
| D-003 | Use specification-driven development with Markdown requirements, including detailed UI/UX | Current user request | Versioned baseline, traceable tasks, acceptance evidence, agent rules |
| D-004 | Use 3DLOOK for Phase 1 measurement integration | Current user request | Confirm exact 3DLOOK product, plan, and technical contract; build adapter |
| D-005 | Three-step journey: design, measurements, order review | Initial user description | Persist draft and allow return to earlier steps with dependency checks |
| D-006 | Conversation and direct selection drive a synchronized visual playground | Initial user description | One configuration source of truth |
| D-007 | Intended audience is adults 25–65+ ordering tailored clothing online | Initial user description | Accessible, clear controls and assisted fallbacks |
| D-008 | Do not begin building yet — superseded by D-012 | Historical planning instruction | Implementation is now authorized |
| D-009 | Phase 1 includes two-piece suits, dress shirts and blazers | User confirmation 2026-09-26 | Extend jacket schema/assets to standalone blazer without assuming identical construction |
| D-010 | Start with menswear | User confirmation 2026-09-26 | Menswear pattern blocks first; exact supported measurements/body range still requires tailor validation |
| D-011 | Desired flow includes AI review, correction and payment, with optional human review before payment | User proposal 2026-09-26 | Replace request-only proposal; detailed rules/eligibility/SLA remain proposed in REVIEW-PAYMENTS.md |

## Proposed defaults — not approved

| ID | Proposal | Reason | Resolution gate |
| --- | --- | --- | --- |
| P-001 | RESOLVED by D-009: suits, shirts and blazers | Earlier suits/shirts proposal expanded by user | Recorded 2026-09-26 |
| P-002 | RESOLVED by D-010: menswear first | Exact pattern blocks/coverage still require tailor approval | Recorded 2026-09-26 |
| P-003 | SUPERSEDED by D-011: automated review and optional human review before checkout | Earlier request-only proposal no longer current | Detailed payment/review contract proposed |
| P-004 | English interface, one market/currency, both cm and inches | Limits translation/commercial scope while supporting measurement preferences | Market and brand definition |
| P-005 | Use 3DLOOK Mobile Tailor subject to contracted integration capabilities | Made-to-measure product alignment | Vendor capability gate |
| P-006 | Genuine browser 3D from the first visual slice; limited assets | Keeps final renderer and asset architecture | Asset feasibility review |
| P-007 | Guided capture handoff/widget for Phase 1, depending on verified vendor interface | Public Mobile Tailor documentation requires guided capture | Vendor capability gate |

No commercial prices, stock quantities, delivery promises, measurement tolerances, or approved fabrics have been supplied. Examples are synthetic fixtures only. The names on reference images are not the application brand or test customers.

## Proposed architecture decisions

| ID | Choice | Rationale | Revisit when |
| --- | --- | --- | --- |
| ADR-001 | Next.js/React/TypeScript modular monolith on Node LTS | Shared contracts and deployable boundaries with low initial operations burden | Independent workload or team requires extraction |
| ADR-002 | PostgreSQL with Drizzle and controlled versioned migrations | Transactions and portable structured data | Hosting requirements change; domain model remains |
| ADR-003 | Replit managed database and App Storage behind access layers | Fits selected initial host | Residency, recovery, performance, or cost requires migration |
| ADR-004 | Authentication under review: self-hosted Better Auth is the preferred proposal for retained Node stack; Clerk remains the managed alternative | User asked about owning authentication; no final selection made | See BACKEND-AUTH-DECISION.md; approve identity policy before coding |
| ADR-005 | OpenAI Responses API with typed tools and application-owned state | Guided conversation with deterministic execution | Evaluation identifies a better provider/model |
| ADR-006 | Inngest durable workflows with bounded Replit handlers | Restart-safe coordination of scans and follow-up processing | Workflow constraints or costs change |
| ADR-007 | Three.js, React Three Fiber, Drei; GLB/glTF viewer assets | Reusable browser renderer and asset contract | Verified performance or compatibility problem |
| ADR-008 | Tailwind, shadcn/ui, Zod; Vitest and Playwright | Consistent UI, validated boundaries, automated evidence | Concrete unmet requirement |
| ADR-009 | Git source control; structured logs and Sentry | Reviewability and diagnosis | Organization operational requirements |

The table preserves the earlier proposal. D-012 now authorizes the proposed foundation; ADR-010 records the implemented choices and bounded deferrals. Unimplemented operational/vendor choices still require their stated evidence.

## Decision entry format

Record: ID; status (proposed/accepted/superseded); question; choice; alternatives considered; rationale; implications; affected requirement IDs; source; approving person; date; superseded decision. Do not rewrite accepted historical entries silently.

## v0.2 change record

User confirmed D-009 and D-010 and requested the D-011 review/payment direction. Added automated-review eligibility, optional human review, checkout, amendments and notifications. Node remains recommended; FastAPI and self-hosted authentication are evaluated in [BACKEND-AUTH-DECISION.md](../architecture/BACKEND-AUTH-DECISION.md). No architecture switch or application build is authorized by this update.

## D-012 — Implementation authorization (accepted 2026-09-26)

User instruction: “Let’s go ahead your proposal to start building.” This accepts the recommended Node/TypeScript + Better Auth foundation and authorizes implementation. D-008 is superseded. External 3DLOOK contracts, real catalog/pricing, payment provider and human-review staffing remain release gates. Working project name: Vessy; final brand not finalized. Synthetic catalog is explicitly development-only and cannot enable production checkout.

## Implementation overlay

See [ADR-010](../architecture/ADR-010-FOUNDATION.md) and [current implementation status](../implementation/STATUS.md). Better Auth and Node/TypeScript are the implemented baseline. Replit remains the target. No live vendor, paid order or human-service approval is implied by foundation authorization.

## D-013 — Human reference and no recurring model license cost (accepted 2026-09-27)

Source/approver: user requested a human figure from head to toe in place of the robotic torso and stated, “I dont want an onging license cost.” The approved direction is a full human 3D clothing reference without recurring model license fees. This adds no customer-scan, cloth-physics or production-fit approval.

Implementation choice within that scope: adapt and bundle CC0 MakeHuman data, with original local clothing surfaces and the existing Three.js renderer. Sources, pinned version, license and offline preparation are retained. There is no model-service subscription, royalty, license server or per-preview vendor call. No paid asset alternative was adopted. Affected requirements: VIS-001–006 and UX-003; evidence in [TASK-011](../delivery/TASK-011.md). Q-008 and Q-014 remain open for personalized models and production validation.

## D-014 — Supplied suit Style and Accents reference seed (accepted 2026-09-27)

Source/approver: user added Hockerty Style and Accents menu exports under `docs` and asked that they be included in application seed data using the existing category structure. The application now normalizes those exports into a versioned suit reference seed with Style and Accents menus, jacket/pants/vest categories, option groups, sections and stable option values.

This authorizes local application use of the supplied files for the reference flow. It does not approve source prices, stock, manufacturing codes, compatibility, brand claims, public asset publication or checkout. Those values remain excluded from customer pricing and production readiness. Affected requirements: CAT-001–006, UX-004, UX-016 and UX-017; evidence in [TASK-012](../delivery/TASK-012.md). Q-011, Q-014 and Q-023 remain release gates.

## D-015 — Unified design input with 2D/3D preview (accepted 2026-09-27)

Source/approver: user interface-refinement instruction. The chat and field-based inputs move together into the left pane with a switch between AI-guided conversation and traditional field selection, navigable through the full option hierarchy. Both lock choices through the same configuration command. The right pane shows the result, with a 2D/3D switch that never alters the selection. Current choices appear as tags that stay readable at 20+ selections while keeping the hierarchy. The 2D view must be interactive and zoom to the area of the choice being selected or changed. Improving the 3D mesh is lower priority and its behaviour stays as is for now.

Implementation choice within that scope: one design outline drives the navigator, tags and 2D focus; tags are grouped per branch with one branch visible at a time; the 2D view is an in-app SVG technical drawing with no new dependency. Affected requirements: UX-003–005, UX-013, UX-015, VIS-001, VIS-002, VIS-005, VIS-006; evidence in [TASK-013](../delivery/TASK-013.md). No 3D change, commercial catalog approval or tailor validation is implied.

## D-016 — Generated 3D garments without an artist (accepted 2026-09-27)

Source/approver: after reviewing the 3D options, the user chose the recommended direction with these limits: no 3D artist; the 3D view is a visualizer that should look good enough, not a detailed fitted design; only the main details appear in 3D, with other details in 2D; target both desktop and mobile, mostly mobile.

Implementation choice within that scope: keep the CC0 MakeHuman body (D-013) and generate garments from body cross-sections sampled offline, with ease, a straight drape from the chest and seat, thickness on lapels, collars and pockets, and studio lighting with a woven, sheened fabric material. No paid tool, artist, downloaded environment map or new dependency. Main 3D choices are listed in `src/visualization/garments/coverage.ts`; other details show in 2D. Affected requirements: VIS-001, VIS-002, VIS-005, VIS-006; evidence in [TASK-014](../delivery/TASK-014.md). Pattern drafting, cloth simulation, tailor validation and real-device performance acceptance are not implied.

## D-017 — Connect the free 3DLOOK SAIA widget; port the paid-scan scaffold inert (accepted 2026-09-28)

Source/approver: user asked to bring the 3DLOOK/SAIA implementation already running in a sibling repository (ClaudeApp/Projects/Vesey) into this application, then explicitly chose "full port including paid-scan entitlements" when asked to scope it. Reviewing that repository showed two distinct pieces: (1) a real, live public widget-capture flow (official 3DLOOK script embed, verified `postMessage` origin/iframe check, person→measurement mapping, draft save) with no charge and no vendor authorization requirement, and (2) a $5 paid single-use-scan entitlement ledger built on Stripe — which in that repository is itself gated behind `providerScanAuthorizationReadiness()` returning `ready: false` and always fails closed with 503 before any Stripe charge is created, because 3DLOOK has not supplied the private single-use scan-authorization capability it depends on.

Implementation choice within that scope: connect (1) as this application's real "Measure with 3DLOOK" capture path — `src/integrations/3dlook.ts` (mapping/trust checks), `src/components/saia-measurement-widget.tsx`, `src/app/api/measurements/saia/*`, new `saia_measurement_drafts`/`measurement_source_snapshots` tables — replacing the old always-503 `/api/capture` stub. Port (2) faithfully but inert, matching the source repository's own fail-closed posture: `src/lib/scan-service-policy.ts`, `src/lib/stripe.ts`, `src/app/api/scan-service/*`, and the `scan_service_payments`/`scan_entitlements`/`garment_credits`/`scan_attempt_events`/`stripe_webhook_events` tables. `POST /api/scan-service/checkout` returns 503 before touching Stripe, exactly as in the source; no Stripe charge, webhook-driven entitlement grant, or garment-credit consumption at checkout is reachable from any current UI path. Garment checkout (`src/integrations/checkout.ts`) is unchanged and still separately gated on its own unconnected payment provider — this decision does not wire garment credits into it. `Measurements.source` can now be recorded as `'3dlook'` (the type already declared this state; the `measurements` command previously never set it). Affected requirements: INT-001–005 (docs/integrations/3DLOOK.md). Vendor sandbox credentials, a signed 3DLOOK API/SDK contract, the private single-use scan-authorization capability, and any live Stripe key remain release gates — none are supplied or assumed by this change.

## D-018 — 3DLOOK requires sign-in; measurement fields expanded for scan accuracy (accepted 2026-09-28)

Source/approver: user follow-up after D-017 asked (1) that 3DLOOK capture require sign-in first, since results save to an account, and (2) that step 2 capture more of what 3DLOOK/SAIA can return, since the 8-field set was narrower than the source repository's. Asked to keep the common tailor-industry fields as the default set and put the rest behind a "show more" affordance, with the same mannequin highlighting the existing fields get.

Implementation choice within that scope: `POST/GET /api/measurements/saia/*` and `POST /api/scan-service/checkout` now reject a guest owner with 401 via a new `requireSignedIn()` helper (`src/lib/http.ts`); the "Measure with 3DLOOK" dialog shows a sign-in prompt instead of the widget when `user` is null (`src/components/measurement-panel.tsx`, `src/components/studio.tsx`). `src/modules/measurements/definitions.ts` adds bicep, forearm, wrist, thigh, knee, calf, ankle, jacket length, front rise and back rise, each flagged `advanced` and mapped from the corresponding SAIA volume/front params in `src/integrations/3dlook.ts`. A new `requiredDefinitionsFor()` — used by `engine.ts`'s confirm gate and `review.ts`'s completeness check — excludes `advanced` fields, so they stay optional; the measurement panel renders them in a collapsible "Add more for accuracy" section that auto-expands once any are filled (by the customer or by a 3DLOOK scan). The 3D mannequin (`src/visualization/garment-view.tsx`) highlights the new fields the same way as the existing eight, using illustrative ring/line coordinates interpolated along the same arm/leg reference paths the existing sleeve and inseam highlights already use — not a body scan or verified anatomical placement, consistent with this view's existing "illustrative reference" framing. Affected requirements: INT-004 (docs/integrations/3DLOOK.md), VIS-001/VIS-002. No new garment construction rule, tailor validation of these fields, or checkout requirement is implied.

