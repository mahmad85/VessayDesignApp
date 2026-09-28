# TASK-015: Database catalog, importer and immutable releases

Status: ready (specified 2026-09-28; not started)

Implementation packages: WP-01 – WP-08 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: product v0.2 with the D-012 foundation overlay; D-019 (admin-driven catalog).
- Implementation authorisation/source: user request of 2026-09-28 plus the D-019 scope answers.
- Requirement IDs and canonical files: CAT-007, CAT-008, CAT-009, CAT-012, CAT-015, CAT-016 (media records), CAT-017 in [CATALOG-ADMIN.md](../domain/CATALOG-ADMIN.md); DDL and the snapshot contract in [ADMIN-BACKEND.md](../architecture/ADMIN-BACKEND.md) §4.1, §5 and §6.
- Acceptance scenario IDs: AC-19 (publish preserves history), and the import and publish portions of AC-34 and AC-43.
- User-visible outcome: none for customers (no behaviour change). Operators can run `npm run catalog:bootstrap`, and `/api/ready` reports a missing catalog.
- In-scope surfaces/modules: `migrations/0003_catalog.sql`; `src/db/client.ts` (`MIGRATIONS`); `src/db/schema.ts`; `src/lib/canonical-json.ts`; `src/lib/money.ts`; `src/modules/catalog/{snapshot,conditions,compile,validate-release,projection,diff,import-legacy}.ts`; `src/visualization/registry.ts` (slots and tokens only, no renderer change yet); `src/db/{release-repository,catalog-admin-repository (loader and read only),audit,media-repository}.ts`; `scripts/catalog-bootstrap.ts` plus the `catalog:bootstrap` package script; `/api/ready`.
- Dependencies and blocking questions: none for the mechanism. Q-011 and Q-023 keep all imported data reference-only.
- Explicit non-goals: changing the customer runtime (TASK-016), prices (TASK-017), admin UI (TASK-018 onward), orders.
- Data/API/asset contracts: the DDL exactly as in ADMIN-BACKEND §4.1; `CatalogSnapshot` per §5; the import mapping per CATALOG-ADMIN §10; the validation codes per CATALOG-ADMIN §7.4.
- Loading/error/empty/recovery behaviour: `ensureCatalog()` auto-bootstraps outside production. In production it raises 503 `catalog_unavailable`.
- Authorisation and privacy requirements: bootstrap actor `system:bootstrap`; no personal data.
- Migration/compatibility implications: the migration is additive and idempotent. The existing tables and code paths are untouched. The seed JSON and `catalog.ts` remain as sources.
- Test fixtures (synthetic or authorised): the user-supplied seed (reference-only) and a synthetic snapshot fixture `tests/fixtures/catalog.synthetic.ts` labelled `SYNTHETIC`.
- Verification plan: see the build steps below; `npm run check`; re-run PGlite start twice (idempotent migration).
- Actual verification evidence: not started.
- Deviations and decision references: D-019.
- Remaining limitations: no customer or admin surface uses the release yet.
- Changed files/commit: —

## Build steps

1. Write `0003_catalog.sql` verbatim from ADMIN-BACKEND §4.1, add it to `MIGRATIONS`, and mirror it in `schema.ts`. Test: start PGlite twice in a temporary directory, with no error the second time.
2. Implement `canonicalJson` + sha256, and `parseMoney`/`formatMinor` with the currency allowlist (PRICING PRC-001). Unit-test edge cases (`"0"`, `"0.5"`, `"1,000"` rejected, `"12.345"` rejected, 10,000,000 limit).
3. Implement the `snapshot.ts` Zod schemas for the complete `CatalogSnapshot` and `CustomerCatalog`.
4. Build `registry.ts`: enumerate every selection key read in `sketch-spec.ts`, `tailored-human.tsx`, `garments/*.ts`, `focus-regions.ts` and `coverage.ts`, and every `RegionId`. For each key, create a slot whose tokens are the seed values for that key plus any literal compared in code (for example `simple_5` and `relaxed`). Export `REGION_IDS`.
5. Implement `import-legacy.ts` per CATALOG-ADMIN §10, including the lookup seeds (§3.8), visibility conditions from `relevantSections`/`visibleGroups`, blazer product settings, the shirt groups, the `relaxed` jacket-fit value, the static media rows, `reference_only` flags and bindings (`visual_slot` and `visual_token` from the registry). Unit tests: 434 seed options imported (plus the added shirt/fit values), import run twice → identical checksum, every binding resolves, and every attribute code equals its seed `selectionKey`.
6. Implement `compile.ts` (working rows → snapshot), `validate-release.ts` (every error and warning code, with one failing fixture each), `projection.ts` (strip list) and `diff.ts`.
7. Implement `release-repository.ts`: `publish(actor, {expectedCurrentVersion, notes, acknowledgeWarnings, warningsChecksum, actionId})` under advisory lock 731851; `getCurrentVersion`; the `getRelease` LRU; `loadSnapshotIntoWorkingCopy` (used by bootstrap and restore); `ensureCatalog`. Write audit events in the same transaction.
8. Add `scripts/catalog-bootstrap.ts` (idempotent: it seeds lookups, loads the import, and publishes v1 only when no release exists) and the `/api/ready` catalog check.
9. Repository tests: publish creates v1 with `reference_only=true` and warnings acknowledged; a second publish with no change is rejected as `nothing_to_publish` (422); concurrent publishes → one gets 409 `stale_release`; restore round-trip keeps the checksum.
