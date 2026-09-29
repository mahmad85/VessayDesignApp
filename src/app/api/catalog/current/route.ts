import { json, failure } from '@/lib/http';
import { ensureCatalog } from '@/db/release-repository';
export const runtime = 'nodejs';
/** The current catalog release version (API-REFERENCE §2.3); never cached. */
export async function GET() {
  try {
    return json({ version: await ensureCatalog() });
  } catch (e) {
    return failure(e);
  }
}
