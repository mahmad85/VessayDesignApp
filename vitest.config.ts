import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Each repository suite starts a separate PostgreSQL WASM instance.
    // Bound concurrency instead of extending business-rule test timeouts.
    maxWorkers: 2,
  },
});
