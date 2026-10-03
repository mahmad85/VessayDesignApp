# Vessy — AI tailoring studio

First runnable implementation, 26 September 2026. Vessy is a working name.

This is the customer-journey foundation of the spec-driven application: a real Next.js/TypeScript application with server-owned drafts, database persistence, self-hosted authentication, interactive 3D references, and tested domain rules. It is **not a live ordering service**. No scan, human-review request or payment is simulated as a successful external action.

## Run locally or in a Replit development workspace

Requires Node.js 22 or newer. Run from the directory containing `package.json`.

```bash
npm ci
npm run dev
```

The development server binds to port 3000. Without `DATABASE_URL`, development uses PGlite, an embedded PostgreSQL runtime, in `.data/postgres`. This works immediately without cloud credentials. PGlite is deliberately rejected in production; it is not an Autoscale database.

For external PostgreSQL, configure `DATABASE_URL` in environment secrets, run `npm run db:migrate` once, then `npm run catalog:bootstrap` to publish catalog release v1 from the reference data (it does nothing once a release exists), then start the application. In development the first readiness check publishes v1 automatically (`CATALOG_AUTO_BOOTSTRAP`). `.env.example` documents available configuration; do not commit secrets. See [Replit deployment](docs/implementation/REPLIT.md).

For a demo, run `npm run seed:demo` after the catalog exists: it fills prices, suppliers, image rights and missing images so a publish has no warnings, keeps anything already entered, and can run again safely (D-023). `npm run seed:demo-images` regenerates the drawings it uses in `public/reference-assets/demo`. Then publish from the admin.

## What works now

- Men’s two-piece suit, dress shirt and blazer configuration; eight explicitly labeled reference fabrics plus 434 supplied suit Style and Accents reference options grouped by jacket, pants and vest.
- A database catalog (TASK-015, TASK-016): working tables, a deterministic importer of today’s reference data, release validation, immutable versioned releases and `npm run catalog:bootstrap`. The studio, the 2D/3D renderers and the assistant run from the published release; a new visitor chooses a garment first, and drafts pin the release they were designed against.
- A server-side pricing engine (TASK-017) quotes every garment live from the release, with a Price details breakdown. The reference catalog has no prices, so the studio says “Price not yet available” rather than showing $0.
- Shared commands for direct selection and assistant suggestions, with compatibility validation, category-change confirmation, version checks and idempotent writes.
- Full human Three.js reference with anatomical face, hands and feet. Suit, blazer, shirt, vest and trousers are generated from the body's own cross-sections, with main construction choices (style, lapels, pockets, vents, sleeve buttons, trouser fit/length/turn-ups, vest, collar and cuffs), skin tone, rotate, front/side/back, zoom and reset. An interactive 2D technical drawing covers every other detail. The bundled CC0 body has no subscription or royalty fees. This is illustrative geometry, not garment simulation or a reconstructed customer body.
- Optional appearance photo stays in browser memory and can be removed. It is displayed as a reference, not mapped to the mannequin.
- Guided conversation without credentials; an OpenAI Responses adapter with schema-validated suggestions when both `OPENAI_API_KEY` and `OPENAI_MODEL` are configured. Live model behavior has not been verified in this build.
- Editable manual measurements in millimetres internally, cm/inches in the UI, highlighted reference paths, saved versions and explicit customer confirmation.
- Multi-garment cart, deterministic order checks, explicit design/measurement sign-off, immutable orders and customer order history. An optional tailor review opens after verified payment; the customer accepts proposed measurements or keeps their original values.
- Stripe Checkout adapter, signed webhook reconciliation and durable payment attempts. Local browser tests use a strictly test-only synthetic provider. No external Stripe sandbox transaction has been run; live charges remain gated. Order-check AI advice is unconfigured and deferred until the remaining functionality is complete ([D-021](docs/product/DECISIONS.md#d-021--defer-ai-features-until-the-remaining-functionality-is-complete-accepted-2026-09-29)); its bounded, privacy-filtered advisory contract is tested independently.
- Better Auth email/password registration, email verification, password-reset endpoints/UI, session cookies, sign-in/out and guest-draft transfer. Local verification emails are written to `.data/mail`; production requires a working email transport.
- Staff access (TASK-018): application-owned roles, authenticator-app enrollment with QR/manual key and backup codes, the guarded `/admin` workroom, owner-managed roles and audit history. See [staff setup](docs/operations/STAFF-ACCESS.md) for the first-owner CLI and production gates.
- Admin catalog editors, suppliers, prices, looks and publish/preview screens are implemented in the local working tree. Media uploads are bounded PNG/JPEG/WebP files with deduplication and immutable serving; full M4 acceptance remains open.
- M6 fulfilment (WP-44–47): order desk, active-manufacturer assignment, reasoned deadline changes, guarded release, production/hold/quality/shipping/delivery transitions, production sheets, live workroom counts and supplier assigned-item views. Support lookup excludes measurements; customer orders show explicit staff-set ETAs and tracking without supplier details. See [M6 evidence](docs/delivery/M6-EVIDENCE.md) for verification and limits.
- Responsive desktop, tablet and mobile layouts; keyboard-accessible dialogs, alternative camera controls and reduced-motion support.

## Integration and release boundaries

3DLOOK is selected for Phase 1 but cannot be wired correctly without the licensed product’s API documentation and credentials. `src/integrations/3dlook.ts` returns an explicit unavailable response. It does not invent a vendor endpoint or measurement result.

The catalog has no approved supplier stock, prices or production rules. The supplied suit menu data is reference-only: source prices remain internal metadata and are not displayed or used for checkout. Reference measurements have not been signed off by a tailor. The implemented review queue has no staffed live service. Production payment, mail, assets, storage, asynchronous capture and fulfilment remain gated. The existing M4 work is preserved but its full acceptance is still open. See [M5 evidence](docs/delivery/M5-EVIDENCE.md), [M6 evidence](docs/delivery/M6-EVIDENCE.md), [current scope](docs/implementation/STATUS.md) and [next tasks](docs/implementation/NEXT-TASKS.md).

## Structure

| Path                | Responsibility                                                                       |
| ------------------- | ------------------------------------------------------------------------------------ |
| `src/app`           | App Router pages and thin HTTP handlers                                              |
| `src/components`    | Customer screens and accessible UI primitives                                        |
| `src/modules`       | Catalog references, validated commands, configuration, measurements and review rules |
| `src/db`            | PostgreSQL/Drizzle schema, owned drafts, atomic revisions and action receipts        |
| `src/integrations`  | Assistant, 3DLOOK, email and payment boundaries                                      |
| `src/visualization` | Interactive reference mannequin and garment renderer                                 |
| `migrations`        | Reviewed PostgreSQL SQL migration files                                              |
| `tests`             | Domain/repository tests and browser acceptance flows                                 |
| `docs`              | Product specifications, decisions, operating contract and implementation evidence    |

## Validation

```bash
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Browser tests start their own development server and override vendor/database environment variables to isolate synthetic test data. Test artifacts must not contain real customer information. On CI, use the provided workflow. See [test evidence](docs/implementation/TEST-EVIDENCE.md) for tests actually run and remaining external validation.

## Continuing with a coding agent

Read `AGENTS.md`, [decisions](docs/product/DECISIONS.md), [implementation status](docs/implementation/STATUS.md), and the assigned task before editing. The admin catalog, pricing, templates, cart, orders, payment and supplier fulfilment work (D-019) starts from [current system](docs/architecture/CURRENT-SYSTEM.md), then [catalog admin](docs/domain/CATALOG-ADMIN.md), [pricing](docs/domain/PRICING.md), [orders and fulfilment](docs/domain/ORDERS-FULFILLMENT.md), [backend design](docs/architecture/ADMIN-BACKEND.md), [API reference](docs/architecture/API-REFERENCE.md), [admin screens](docs/ux/ADMIN-SCREENS.md), and tasks TASK-015 to TASK-027 in [next tasks](docs/implementation/NEXT-TASKS.md). The full product specifications are the target; the implementation matrix is the honest current state. Do not turn unavailable integrations into fake successes or silently mark a partial acceptance scenario complete.

Fonts are self-hosted from Fontsource packages; their upstream licenses remain with those packages. The anatomical body and eye assets are adapted from CC0 MakeHuman data; [source, license and offline build](assets/human-source/README.md) are included. Garment surfaces, shoes and hair adaptation are local geometry. The supplied Hockerty menu thumbnails are isolated under `public/reference-assets/hockerty-suit`, marked reference-only, and require rights review before any public release.
