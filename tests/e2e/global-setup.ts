import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
export default function setup() {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: '',
    MAIL_API_URL: '',
    MAIL_API_TOKEN: '',
    MAIL_FROM: '',
    APP_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'synthetic-test-secret-never-use-for-production',
    VESSY_DEV_DATABASE_PATH:
      process.env.VESSY_DEV_DATABASE_PATH ||
      process.env.VESSY_QA_DATABASE_PATH ||
      '.data/qa-postgres',
  };
  execFileSync(process.execPath, ['--import', 'tsx', 'tests/e2e/setup-staff.ts'], {
    env,
    stdio: 'pipe',
  });
  const { email } = JSON.parse(readFileSync('.data/qa-staff.json', 'utf8'));
  const catalog = JSON.parse(readFileSync('.data/qa-catalog.json', 'utf8'));
  execFileSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/staff-grant.ts', '--email', catalog.email, '--role', 'owner'],
    { env, stdio: 'pipe' },
  );
  execFileSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/staff-grant.ts', '--email', email, '--role', 'owner'],
    { env, stdio: 'pipe' },
  );
}
