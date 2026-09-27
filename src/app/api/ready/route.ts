import { getDatabase } from '@/db/client';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const db = await getDatabase();
    await db.query('SELECT id FROM drafts LIMIT 1');
    return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { status: 'not_ready' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
