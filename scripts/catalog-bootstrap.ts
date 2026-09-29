import 'dotenv/config';
import { bootstrapCatalog } from '../src/db/release-repository';

// Creates catalog release v1 from today's reference data when no release exists
// (CATALOG-ADMIN.md §10, TASK-015). Idempotent: once a release exists it only
// makes sure the system lookup types are present. With hosted PostgreSQL, run
// `npm run db:migrate` first. The imported catalog is reference-only and
// cannot be ordered in production (CAT-017).

const result = await bootstrapCatalog();
console.log(
  result.created
    ? `Published catalog v${result.version} from the reference data (reference-only).`
    : `A catalog release already exists (current v${result.version}); nothing to publish.`,
);
process.exit(0);
