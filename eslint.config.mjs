import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Three.js exposes a mutable scene graph. Camera updates inside effects are
  // deliberate renderer operations, not mutation of React application state.
  { files: ['src/visualization/**/*.tsx'], rules: { 'react-hooks/immutability': 'off' } },
  globalIgnores([
    '.next/**',
    '.data/**',
    'test-results/**',
    'playwright-report/**',
    'artifacts/**',
  ]),
]);
