# TASK-026: Production object storage for catalog media

Status: blocked on Q-024 (dependency approval and provider choice)

Implementation packages: WP-48 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: ADR-003 (Replit App Storage proposed); D-019.
- Implementation authorisation/source: requires explicit approval of the new dependency (SECURITY-RELEASE.md OPS-001).
- Requirement IDs and canonical files: CAT-016; ADMIN-BACKEND §9 (the `object_store` driver).
- Acceptance scenario IDs: AC-22 (the storage portion), AC-45 (in production).
- User-visible outcome: admin uploads persist in production and are served through `/api/media/{id}`.
- In-scope surfaces/modules: `integrations/storage/object_store.ts`; configuration; a migration utility that copies local-driver media into the object store for staging.
- Dependencies and blocking questions: Q-024.
- Explicit non-goals: customer photo storage; image transformation.
- Data/API/asset contracts: the `StorageProvider` interface.
- Loading/error/empty/recovery behaviour: storage outage → upload 503; serving falls back to a 404 image.
- Authorisation and privacy requirements: bucket credentials are secrets; catalog media only.
- Migration/compatibility implications: `storage_driver='object_store'` rows.
- Test fixtures (synthetic or authorised): synthetic images; sandbox bucket.
- Verification plan: an integration test against a staging bucket; a restore rehearsal.
- Actual verification evidence: not started.
- Deviations and decision references: —
- Remaining limitations: —
- Changed files/commit: —
