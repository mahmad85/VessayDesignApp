import { getDatabase } from '@/db/client';
import { catalogAutoBootstrap, ensureCatalog, getCurrentVersion } from '@/db/release-repository';
export const runtime = 'nodejs';
const notReady = (reason?: string) =>
  Response.json(reason ? { status: 'not_ready', reason } : { status: 'not_ready' }, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
export async function GET() {
  try {
    const db = await getDatabase();
    await db.query('SELECT id FROM drafts LIMIT 1');
  } catch {
    return notReady();
  }
  try {
    // Outside production the first check creates catalog v1 (CATALOG_AUTO_BOOTSTRAP).
    if (!(await getCurrentVersion())) {
      if (!catalogAutoBootstrap()) return notReady('catalog_missing');
      await ensureCatalog();
    }
  } catch {
    return notReady('catalog_missing');
  }
  return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
}
