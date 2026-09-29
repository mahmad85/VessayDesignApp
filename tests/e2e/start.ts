import setup from './global-setup';
import { spawn } from 'node:child_process';
setup();
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '0.0.0.0', '--port', '3000'],
  { env: { ...process.env, NODE_ENV: 'test' }, stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => child.kill(signal));
