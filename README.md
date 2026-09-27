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

For external PostgreSQL, configure `DATABASE_URL` in environment secrets, run `npm run db:migrate` once, then start the application. `.env.example` documents available configuration; do not commit secrets. See [Replit deployment](docs/implementation/REPLIT.md).

## What works now

- Men’s two-piece suit, dress shirt and blazer configuration; eight explicitly labeled reference fabrics plus 434 supplied suit Style and Accents reference options grouped by jacket, pants and vest.
- Shared commands for direct selection and assistant suggestions, with compatibility validation, category-change confirmation, version checks and idempotent writes.
- Full human Three.js reference with anatomical face, hands and feet. Suit, blazer, shirt, vest and trousers are generated from the body's own cross-sections, with main construction choices (style, lapels, pockets, vents, sleeve buttons, trouser fit/length/turn-ups, vest, collar and cuffs), skin tone, rotate, front/side/back, zoom and reset. An interactive 2D technical drawing covers every other detail. The bundled CC0 body has no subscription or royalty fees. This is illustrative geometry, not garment simulation or a reconstructed customer body.
- Optional appearance photo stays in browser memory and can be removed. It is displayed as a reference, not mapped to the mannequin.
- Guided conversation without credentials; an OpenAI Responses adapter with schema-validated suggestions when both `OPENAI_API_KEY` and `OPENAI_MODEL` are configured. Live model behavior has not been verified in this build.
- Editable manual measurements in millimetres internally, cm/inches in the UI, highlighted reference paths, saved versions and explicit customer confirmation.
- Honest automated completeness findings, correction links, unavailable human-review state, draft JSON export and blocked checkout.
- Better Auth email/password registration, email verification, password-reset endpoints/UI, session cookies, sign-in/out and guest-draft transfer. Local verification emails are written to `.data/mail`; production requires a working email transport.
- Responsive desktop, tablet and mobile layouts; keyboard-accessible dialogs, alternative camera controls and reduced-motion support.

## Integration and release boundaries

3DLOOK is selected for Phase 1 but cannot be wired correctly without the licensed product’s API documentation and credentials. `src/integrations/3dlook.ts` returns an explicit unavailable response. It does not invent a vendor endpoint or measurement result.

The catalog has no approved supplier stock, prices or production rules. The supplied suit menu data is reference-only: source prices remain internal metadata and are not displayed or used for checkout. Reference measurements have not been signed off by a tailor. Human review has no staffed queue or live 24-hour service. Payment, notifications, production assets, storage, asynchronous capture workflows and staff administration remain in the next implementation slices. See [current scope](docs/implementation/STATUS.md) and [next tasks](docs/implementation/NEXT-TASKS.md).

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

Read `AGENTS.md`, [decisions](docs/product/DECISIONS.md), [implementation status](docs/implementation/STATUS.md), and the assigned task before editing. The full product specifications are the target; the implementation matrix is the honest current state. Do not turn unavailable integrations into fake successes or silently mark a partial acceptance scenario complete.

Fonts are self-hosted from Fontsource packages; their upstream licenses remain with those packages. The anatomical body and eye assets are adapted from CC0 MakeHuman data; [source, license and offline build](assets/human-source/README.md) are included. Garment surfaces, shoes and hair adaptation are local geometry. The supplied Hockerty menu thumbnails are isolated under `public/reference-assets/hockerty-suit`, marked reference-only, and require rights review before any public release.
