# Implementation status — foundation v0.1

Date: 2026-09-26. Authorization: user said “Let’s go ahead your proposal to start building.” This supersedes the previous no-build instruction. The source includes the v0.2 target specifications with this implementation overlay.

## Current release boundary

Runnable and locally verified customer-journey foundation; **not published to Replit and not approved for real customer orders**. Replit is still the deployment target. No alternative host was substituted. The Replit integration is not connected in this session.

| Capability | Current implementation | Outstanding work |
| --- | --- | --- |
| Three-step design/measure/review journey | Implemented | Representative user testing and final brand |
| Garment categories/cart | Suit, shirt and blazer from the release; up to 10 independent garments, quantities, removal confirmation and one measurement profile (TASK-022) | Tailor-approved production construction schemas |
| Catalog | Database catalog release v1 imported from the eight reference fabrics and the 434 supplied suit Style/Accents options (TASK-012, TASK-015); the studio, renderers and assistant read the published release (TASK-016); admin editors and publish UI exist in the local working tree | Approved supplier ownership, stock, prices, compatibility and asset rights; independent M4 full acceptance |
| Configuration | Server-owned multi-garment draft v2, shared commands, rule/rebase consent, revisions and action receipts; all edits clear the order check | Production catalog data |
| Consultation | Guided mode on the release's labels and a real OpenAI adapter with a bounded catalog context; every suggestion is dry-run on the release and needs explicit acceptance | API key/model, live behavior evaluations, streaming UX, usage monitoring and consent copy |
| 3D design | Bundled CC0 anatomical human GLB, local suit/shirt/blazer surfaces, and material/construction controls; no recurring model license fee (TASK-011) | Production garment assets, cloth/fit validation, verified model output from 3DLOOK |
| Appearance image | Removable local image reference | Face mapping is not implemented or promised |
| Measurements | Manual editing, cm/in switch, source marker, snapshots, confirmation, measurement paths | Live 3DLOOK capture, consent, authenticated result handling, metric mapping, quality and override provenance |
| Automated order check | Current release, design, measurement, price and availability checks; explicit versioned sign-off. Optional advisory contract with safe failure (TASK-023) | WP-38 OpenAI adapter and live evaluation deferred under D-021 until the remaining functionality is complete; approved legal wording remains a release gate |
| Tailor review | Optional after verified payment; authorized queue, claim, proposal/verification, customer accept/keep, immutable amendment and overdue outbox | Staffed SLA and production delivery; no fit guarantee |
| Pricing | Deterministic server-side quotes from the published release (base price plus fabric tier uplift or a fabric override; optional parts and choices carry extra prices, D-022); garment price, cart total and a Price details breakdown; “Price not yet available”, never $0, for the unpriced reference catalog (TASK-017) | Real prices and currency (Q-011, Q-019), tax, the admin pricing UI (TASK-020), persisted quotes (TASK-023) |
| Orders/payment | Immutable signed-off order/quote/item history; customer list/details; Stripe adapter, durable attempts and signed reconciliation; synthetic browser journey (TASK-024) | External Stripe sandbox verification and live commercial authorization; production reference data remains blocked |
| Fulfilment/support | M6 order desk, supplier assignment/deadlines, guarded release/status machine, production sheets, supplier items, customer tracking/ETA, support lookup and live dashboard (TASK-025) | Manual supplier dispatch/refunds; Q-027/Q-029/Q-030; hosted concurrency/load, production mail and external operational verification |
| Identity | Better Auth, database sessions, verification, password reset code, sign-in/out, guest transfer; staff roles and authenticator MFA | Live mail validation, account erasure lifecycle and production security review |
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

The order notification outbox, staff review UI and payment adapter are implemented locally. The M4 working-tree catalog changes still need their own outstanding acceptance. Hosted PostgreSQL, production object storage, Inngest/capture workflows, account deletion and live vendor callbacks remain bounded follow-up work.

The conversation currently returns a completed structured reply; streaming is still pending. The current model remains a reference even if a photo is added. Review checks are deterministic, not an AI-certified fit assessment.

## Human reference update — 2026-09-27

[TASK-011](../delivery/TASK-011.md) replaces the primitive figure with a complete anatomical human mesh, including facial features, hair, fingers and feet. Clothing uses continuous sleeves, fitted jacket/shirt surfaces, actual option-dependent details, shaped trousers and shoes. Measurement mode uses the same generic body with shorts and revised annotation positions. The 320px view reserves space so camera buttons do not cover the feet.

Source assets, CC0 license, pinned commit, offline build and model manifest are included. The model is served from the application; it has no subscription, royalty or external runtime model service. No new dependencies or migrations were introduced. Local verification is recorded in the task and test evidence. Customer likeness, personal body shape, cloth physics, real-device performance and production acceptance remain unverified; no release or external approval is claimed.

## Supplied suit customization seed — 2026-09-27

[TASK-012](../delivery/TASK-012.md) adds a reproducible seed generator for the supplied suit Style and Accents exports. The generated seed contains 434 choices with stable IDs and the supplied jacket, pants and vest hierarchy. Direct choices are validated server-side, saved in the existing draft revision, and selected mapped fields continue to drive the 3D reference.

Source prices are retained only as unapproved reference metadata and do not appear in the customer flow or make checkout eligible. The copied thumbnails are isolated as reference assets. Supplier ownership, availability, compatibility, manufacturing interpretation, terminology review and publication rights remain unverified.

## Unified design input and 2D preview — 2026-09-27

[TASK-013](../delivery/TASK-013.md) (D-015) moves all design input to the left pane: **Ask your tailor** (conversation, guided choices, accepted suggestions) and **Choose details** (All details → essentials, jacket, trousers, vest, accents → group → options, with breadcrumb and previous/next stepping). Both use the same server command. The right pane has a 2D/3D switch; switching never changes the saved selection. Current choices are editable tags grouped by branch below the preview.

The 2D view is an interactive SVG technical drawing derived from saved choices. It zooms to the group being edited or the choice just changed, including changes applied from chat, switches to back or inside views for vents, elbow patches, back pockets, lining, canvas and monogram, and fades the jacket to show trouser or vest details. It supports pan, zoom, keyboard control and edit markers. Accessory and lining fills use the supplied thumbnails. It is illustrative and not tailor-validated.

3D is unchanged. The procedural garment surfaces cause the rough, paper-thin collars and gaps at shoulders and cuffs. A depth-offset adjustment was tried and gave no visible gain, so it was reverted. Realistic improvement needs authored garment assets rather than renderer tweaks: pattern-based garments made in a cloth tool such as Marvelous Designer or CLO and exported to GLB on the existing CC0 MakeHuman body, or MakeHuman/MPFB2 clothing assets. A licence-free parametric body model is an alternative if personalised bodies are needed later. SMPL-family models need a commercial licence, which conflicts with D-013. The vendor body from 3DLOOK (Q-008) remains the route to a personal body shape. None of these were adopted.

## Generated 3D garments — 2026-09-27

[TASK-014](../delivery/TASK-014.md) (D-016) replaces the hand-shaped 3D garment tubes and flat pieces with garments generated from cross-sections of the CC0 reference body. Sleeves now join the shoulders, cloth drapes over hollows, and lapels, collars and pockets have thickness. Studio lighting and a woven, sheened fabric material replace the flat look. Only the main choices are drawn in 3D; the preview points to 2D for linings, monogram, threads and accessories. It remains an illustrative visualizer with no pattern drafting, cloth simulation or tailor validation, and real mid-range phone performance is still unmeasured.


## Admin catalog, commerce and fulfilment — specified 2026-09-28; catalog foundation locally verified

D-019 adds specifications for a database-driven catalog with an admin panel, lookups, expert fabric metadata, rules, versioned releases, templates, band-based additive pricing, a multi-garment cart, orders with review cases, Stripe Checkout (test mode), supplier management and fulfilment tracking, plus staff roles with MFA. Delivery is TASK-015 to TASK-027 ([next tasks](NEXT-TASKS.md)), split into work packages in [IMPLEMENTATION-PLAN.md](../delivery/IMPLEMENTATION-PLAN.md).

**Progress, 2026-09-28** (branch `feature/phase0-m1-catalog-foundation`, local verification only): Phase 0 and M1 are done. The baseline was re-verified and golden 2D/3D renderer outputs were recorded (WP-00a, WP-00b). TASK-015 (WP-01 – WP-08) added migration `0003_catalog`, the catalog snapshot contract and condition language, the visual slot registry, the legacy importer (the supplied seed, the shirt and blazer fields and the 8 reference fabrics, all reference-only), the working-copy compiler and loader, release validation, the customer projection, snapshot diffs and the release repository with `npm run catalog:bootstrap`. Outside production the first catalog-dependent request (currently `/api/ready`) publishes catalog v1; in production an operator runs the script, and `/api/ready` reports `catalog_missing` until then. Evidence: [TASK-015](../delivery/TASK-015.md) and [test evidence](TEST-EVIDENCE.md).

**TASK-016 (M2, WP-09 – WP-16), 2026-09-28, local verification only:** the customer studio now runs from the published release. Drafts are v2 (garments pinned to a release, upgraded lazily from v1), the tabs, options and 2D/3D renderers are driven by the catalog and the visual slot registry (the recorded goldens are unchanged), `/api/catalog/current`, `/api/catalog/v/{version}` and `/api/media/{id}` serve the release, live fabric availability is overlaid, and the assistant is grounded in the release. Evidence: [TASK-016](../delivery/TASK-016.md).

**TASK-017 (M2, WP-17 – WP-18), 2026-09-29, local verification only:** the pricing engine (PRICING.md, worked examples E1 – E7) prices every studio response live from the current release; the studio shows the garment price, the cart total, a Price details breakdown by category and “+$X” on priced choices. The imported reference catalog has no prices, so customers see “Price not yet available”; prices were verified end to end with SYNTHETIC prices only. **M2 is complete:** the studio runs from the published release, the recorded visuals are unchanged, and prices display. Evidence: [TASK-017](../delivery/TASK-017.md).

## 2D male figure and measurement dummy — 2026-09-27

The 2D drawing uses a male figure: square jaw, short tapered haircut (faded at the nape from behind), a short strong neck, broad square shoulders, a V-shaped jacket, arms standing clear of the waist, larger hands and men's dress shoes. The drawing keeps a strip below it for the view controls so the feet are never covered. The measurement step shows the 3D body as a plain white shop dummy with no skin tone, hair or eyes; the design step is unchanged.

## M5 ordering — 2026-09-29

WP-37 and WP-39–43 are implemented locally. The cart → deterministic check → explicit sign-off → immutable order → signed synthetic payment → optional tailor proposal → customer amendment journey is covered by automated and browser tests. WP-38's non-AI scope and provider-independent advisory privacy/validation/timeout contract are locally verified; the actual OpenAI adapter is deferred under D-021 until the remaining functionality is complete. **The original full M5 scope remains open with AI deferred.** M6 followed as the next independent non-AI slice; see the current overlay below. M4 acceptance is still open. Nothing is externally verified, merged or released. The exact requirements, checks, screenshots, operational instructions and remaining gates are in [M5-EVIDENCE.md](../delivery/M5-EVIDENCE.md).

## M6 fulfilment — 2026-09-29

**WP-44–47 are implemented and locally verified; WP-47 is the last completed package.** Staff can assign manufacturers/deadlines, release eligible paid items, record production/holds/quality/shipment/delivery, print production sheets using current accepted measurements and find customers safely. Supplier views and the dashboard show current work; customers see explicit ETA/tracking without supplier identities or internal notes.

`npm run check` passed with 316 tests in 37 files and the optimized build; full Playwright passed 16/16, followed by a focused M6 pass. Fifty responsive captures passed axe/overflow checks; keyboard activation, representative visual inspection, catalog projection size, scoped security review, formatting/diff checks and a zero-vulnerability audit are recorded in [M6-EVIDENCE.md](../delivery/M6-EVIDENCE.md). Hosted database concurrency, external Stripe/mail, real supplier dispatch and customer release remain unverified. M4 full acceptance remains open and AI remains deferred under D-021. Remaining numbered packages are gated WP-48 and optional WP-49; see [next tasks](NEXT-TASKS.md).

## PR #2 CI follow-up — 2026-09-29

Staff enrollment now keeps its server-rendered controls disabled until hydration, preventing a native form reload before the authenticator API request. The deterministic delayed-script regression and existing staff keyboard, TOTP and denial journeys pass locally (2/2). Repository typecheck, lint, 316 tests, production build and formatting also passed; latest-head CI is recorded on PR #2; see [PR-2-CI.md](../delivery/PR-2-CI.md). This is a focused AUTH-004 / ADM-002 fix, with no change to existing milestone or production-release gates.

The subsequent CI runs passed the staff regression and exposed premature M6 accessibility scanning during support navigation. The test now asserts loaded customer/order content and a non-empty title before scanning. Full focused M6 verification passed locally (1/1, 50 captures), with all accessibility and privacy assertions retained; see the same CI evidence record.

A later push run passed all 316 tests and 16 browser journeys. A staff screenshot font-wait timeout in the parallel PR run led to narrowing the delayed-hydration test hook to JavaScript and separating its reload from the initial navigation. The focused staff suite passed again (2/2); the original timeout, font readiness and all acceptance assertions remain.

## Simplified catalog admin — 2026-10-02 (D-022)

The admin menu is Catalog (Products, Fabrics, Publish & history), Operations and Settings. Each product has one page: name, base price, description, fabric shown first, image, visibility, the categories it includes (optional extras with a price) and, per category, Style and Accents subcategories that can be ticked on or off for that product and edited inline (choice names, images, extra prices, default). A new product is a draft copy of an existing one; an unpublished product can be deleted. Fabric price tiers and their uplift amounts are edited on the Fabrics page. Migration 0008 adds `products.base_price_minor` and `price_bands.uplift_minor`. Group and option fees are no longer charged. Compatibility rules, ready-made styles, lists, media and the band price matrix are out of the menu; the full structure editor remains at `/admin/catalog/structure` for developers. Static reference media now redirect with a relative Location, so images load behind `next dev --hostname 0.0.0.0`.

Follow-up 2026-10-03: adding a product, category, subcategory or choice, and a subcategory's choices grid, open in modals instead of expanding on the page. Each modal checks its fields before saving (required unique name of at most 200 characters, exact price format, PNG/JPEG/WebP image up to 5 MB) and shows server field errors next to the field. The grid keeps a default choice and at least one choice on for the product. Focus moves to the first field to fix and returns to the opening button on close.

Not done: real prices (none supplied), tier assignment for the 8 active reference fabrics, the Playwright browser suites, and an ADMIN-SCREENS.md revision.

## Demo catalog — 2026-10-03 (D-023)

`npm run seed:demo` (`src/db/demo-catalog.ts`) completes the working catalog for the demo: demo approval note on reference images, reference-only flags cleared, Hockerty reference prices as choice prices, a synthetic demo supplier and tiers for the reference fabrics, demo base prices and (only while all are zero) tier uplifts, and drawings from the app's 2D renderer for products and choices without an image. Applied locally on 2026-10-03: 0 errors and 0 warnings in the working copy; release v1 is still live until the next publish. Evidence: `demo-catalog.test.ts`.
