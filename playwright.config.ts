import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 40000,
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3013',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: 'pnpm start --port 3013',
        url: 'http://localhost:3013',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
