// SYNTHETIC only. Runs in a separate process before the browser server opens PGlite.
import { mkdir, writeFile } from 'node:fs/promises';
import { createSyntheticUser } from '../helpers/users';
import { grantRole } from '../../src/db/staff-repository';
const user = await createSyntheticUser({ name: 'SYNTHETIC Workroom Owner' });
const catalog = await createSyntheticUser({ name: 'SYNTHETIC Catalog Owner' });
const ordering = await createSyntheticUser({ name: 'SYNTHETIC Ordering Customer' });
await mkdir('.data', { recursive: true });
await writeFile(
  '.data/qa-staff.json',
  JSON.stringify({ email: user.email, password: user.password }),
);
await writeFile(
  '.data/qa-catalog.json',
  JSON.stringify({ email: catalog.email, password: catalog.password }),
);
await writeFile(
  '.data/qa-orders.json',
  JSON.stringify({ email: ordering.email, password: ordering.password }),
);
for (const [name, role] of [
  ['fulfillment-staff', 'owner'],
  ['fulfillment-support', 'support'],
  ['fulfillment-customer', null],
] as const) {
  const account = await createSyntheticUser({ name: 'SYNTHETIC ' + name });
  if (role) await grantRole({ email: account.email, role }, 'system:browser_tests');
  await writeFile(
    '.data/qa-' + name + '.json',
    JSON.stringify({ email: account.email, password: account.password }),
  );
}
process.exit(0);
