import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      APP_URL: 'http://localhost:3000',
      DATABASE_URL: '',
      OPENAI_API_KEY: '',
      OPENAI_MODEL: '',
      MAIL_API_URL: '',
      MAIL_API_TOKEN: '',
      MAIL_FROM: '',
      BETTER_AUTH_SECRET: 'synthetic-test-secret-never-use-for-production',
      NEXT_TELEMETRY_DISABLED: '1',
      VESSY_DEV_DATABASE_PATH: process.env.VESSY_QA_DATABASE_PATH || '.data/qa-postgres',
      // Enables the SYNTHETIC catalog hook (/api/test/catalog) for this development server only.
      VESSY_E2E_HOOKS: 'true',
    },
  },
});
