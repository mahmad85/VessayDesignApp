# TASK-012: Supplied suit Style and Accents seed

Status: verified locally; reference-only; not externally approved or released

- Approved baseline: product v0.2, authorized foundation v0.1 overlay (D-012).
- Implementation authorization/source: user supplied Hockerty suit Style and Accents exports under `docs` and explicitly requested their inclusion in application seed data on 2026-09-27. D-014 records the accepted reference scope.
- Requirement IDs and canonical files: CAT-001–006 in `docs/domain/CATALOG.md`; UX-004, UX-016 and UX-017 in the UX specifications.
- Acceptance scenario IDs: local reference portions of AC-02, AC-07, AC-17 and AC-19.
- User-visible outcome: suit customers can browse and save 434 supplied choices through Style and Accents, organized under jacket, pants and vest categories with the supplied group and section structure and local thumbnails.
- In-scope surfaces/modules: reproducible source normalizer, generated typed seed, local reference assets, suit configuration validation, shared draft commands, mapped 3D fields, responsive catalog controls and persistence checks.
- Dependencies and blocking questions: Q-011, Q-014 and Q-023 still gate production catalog publication and public use of supplied assets.
- Explicit non-goals: approved prices, inventory, manufacturing availability, inferred compatibility, live supplier endpoints, checkout eligibility, public deployment or production asset approval.
- Data/API/asset contracts: generated seed hierarchy is menu → category → group → section → option. Stable `selectionKey` and option values are accepted through the existing design command. Source prices are retained as `referencePrice` metadata only and are not displayed or used for checkout. Assets are copied under `public/reference-assets/hockerty-suit`.
- Loading/error/empty/recovery behavior: seed and assets are bundled locally; category/group strips scroll horizontally and option sections scroll vertically. Existing design controls and 3D fallback remain usable. Saved selections reload from the server-owned draft.
- Authorization and privacy requirements: synthetic guest/account ownership behavior is unchanged. No customer personal data is added. Supplied asset publication rights are unresolved and recorded in Q-023.
- Migration/compatibility implications: no database migration or new dependency. Older suit drafts receive seed defaults without overwriting stored values; non-suit drafts reject suit customization entries.
- Test fixtures (synthetic or authorized): user-supplied menu exports and existing synthetic guest drafts. No live supplier response is claimed.
- Verification plan: regenerate the seed; validate counts, unique IDs and local assets; typecheck, lint, domain/repository tests and production build; browser selection, mapped preview state, reload persistence, fallback, keyboard camera controls and responsive layouts; inspect Style/Accents screenshots.
- Actual verification evidence: generator produced 434 options across two menus and copied 478 local source files. TypeScript and ESLint passed. Seventeen Vitest checks passed across two files. The optimized Next.js build passed. Two focused Chrome browser scenarios passed after the current development server was restarted: Style/Accents selection and reload persistence, mapped garment changes, keyboard camera controls, 1440/768/390/320 layouts, and the 3D failure fallback. Changed-code formatting passed. Screenshots were visually inspected.
- Deviations and decision references: D-014. The source hierarchy is preserved while folder names are normalized into stable application IDs. No source price or code was promoted to an approved commercial value.
- Remaining limitations: no supplier/tailor terminology sign-off, compatibility graph, inventory, currency/price approval, public asset rights, production visual mapping, hosted deployment or external validation. The workspace has no Git metadata, so no commit/diff can be reported.
- Changed files/commit: generator and package script; generated seed; catalog/configuration types and engine; design UI and styles; local reference assets; domain/browser tests; README, decision, open-question, status, evidence and traceability records. No commit.

## Visual evidence

`artifacts/human-preview/suit-style-catalog.png` and `suit-accents-catalog.png` show the running desktop catalog with supplied thumbnails and selected states. The existing `preview-768-visible.png`, `preview-390.png` and `preview-320.png` confirm the complete preview remains usable at the tested responsive sizes. Screenshots are supporting evidence; the passing browser test verifies interaction and reload persistence.
