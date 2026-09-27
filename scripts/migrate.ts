import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { getDatabase, MIGRATIONS } from '../src/db/client';
const db = await getDatabase();
await db.transaction(async (query) => {
  await query('SELECT pg_advisory_xact_lock(731850)');
  await query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of MIGRATIONS) {
    const existing = await query('SELECT name FROM schema_migrations WHERE name=$1', [name]);
    if (existing.length) continue;
    const sql = await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8');
    for (const statement of sql.split(';').filter((s) => s.trim())) await query(statement);
    await query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
  }
});
console.log('Database migrations are current.');
process.exit(0);
