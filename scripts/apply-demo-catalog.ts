// Fills the working catalog with the demo data described in D-023, so the next
// publish has no warnings. Safe to run more than once. Demo environments only.
// Run with: npm run seed:demo
import 'dotenv/config';
import { getDatabase } from '../src/db/client';
import { applyDemoCatalog } from '../src/db/demo-catalog';

if (process.env.NODE_ENV === 'production' && process.env.VESSY_DEMO_CATALOG !== 'true')
  throw new Error(
    'The demo catalog is for demo environments. Set VESSY_DEMO_CATALOG=true to apply it.',
  );
const db = await getDatabase();
const summary = await db.transaction(async (query) => {
  // The same lock as admin edits, so a publish never sees half of the change.
  await query('SELECT pg_advisory_xact_lock(731851)');
  return applyDemoCatalog(query, 'system:demo_seed');
});
console.log('Demo catalog applied:', JSON.stringify(summary));
console.log('Publish from the admin to make it live.');
process.exit(0);
