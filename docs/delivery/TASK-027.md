# TASK-027: Fabric CSV import/export and bulk tools (should-have)

Status: ready after TASK-020 (optional; schedule when real fabric data is available, Q-011)

Implementation packages: WP-49 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019 (“define everything in an intuitive way”) and CAT-009.
- Implementation authorisation/source: D-019.
- Requirement IDs and canonical files: CAT-009; ADM-004 (bulk work).
- Acceptance scenario IDs: AC-35 (the import validation portion).
- User-visible outcome: a catalog manager downloads fabrics as CSV, edits them in a spreadsheet, and uploads the file. A dry run shows row-level errors and a create/update/unchanged summary before anything is committed. Committing is all-or-nothing and audited.
- In-scope surfaces/modules: `POST /api/admin/catalog/materials/import` (`{mode:'dry_run'|'commit', csv}` ≤ 2 MB, `catalog.write`) and `GET /api/admin/catalog/materials/export.csv`; a small RFC 4180 parser in `src/lib/csv.ts` (no new dependency); a dialog on ADM-04.
- Dependencies and blocking questions: Q-011.
- Explicit non-goals: image import through CSV (media stays in the library; CSV references a media id); supplier import.
- Data/API/asset contracts: columns = the `MaterialInput` fields in snake_case. Arrays are `|`-separated lookup codes. Composition is `wool:98|elastane:2`. Money is a decimal string converted with `parseMoney`. The `code` column is the key.
- Loading/error/empty/recovery behaviour: row and column error list; a failed commit changes nothing.
- Authorisation and privacy requirements: `catalog.write`; CSV formula-injection protection on export (prefix cells that start with `= + - @` with `'`).
- Migration/compatibility implications: none.
- Test fixtures (synthetic or authorised): a synthetic CSV including malformed quoting, unknown lookups and duplicate codes.
- Verification plan: parser tests; dry-run and commit parity; an audit row per changed material.
- Actual verification evidence: not started.
- Deviations and decision references: —
- Remaining limitations: —
- Changed files/commit: —
