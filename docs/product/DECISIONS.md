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
