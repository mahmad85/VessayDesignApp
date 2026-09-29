import 'dotenv/config';
import { parseArgs } from 'node:util';
import { grantRole, revokeRole } from '../src/db/staff-repository';
import { getDatabase } from '../src/db/client';
const { values } = parseArgs({
  options: { email: { type: 'string' }, role: { type: 'string' }, revoke: { type: 'boolean' } },
  strict: true,
});
try {
  if (!values.email || !values.role)
    throw new Error(
      'Usage: npm run staff:grant -- --email <verified email> --role <role> [--revoke]',
    );
  if (values.revoke) {
    const [user] = await (
      await getDatabase()
    ).query<{ id: string }>('SELECT id FROM "user" WHERE lower(email)=$1 AND email_verified=true', [
      values.email.toLowerCase(),
    ]);
    if (!user) throw new Error('No verified account was found.');
    await revokeRole({ userId: user.id, role: values.role }, 'system:cli');
    console.log('Role revoked.');
  } else {
    await grantRole(values, 'system:cli');
    console.log('Role granted.');
  }
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Staff command failed.');
  process.exit(1);
}
