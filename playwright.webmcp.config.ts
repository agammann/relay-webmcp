import { defineConfig } from '@playwright/test';

const target = process.env.RELAY_WEBMCP_URL;
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/native-webmcp.spec.ts',
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL: target || 'http://localhost:3016',
    channel: process.env.RELAY_WEBMCP_CHANNEL || 'chrome',
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--enable-features=WebMCP'],
      ignoreDefaultArgs: ['--disable-back-forward-cache'],
    },
  },
  webServer: target
    ? undefined
    : {
        command: 'pnpm start --port 3016',
        url: 'http://localhost:3016',
        reuseExistingServer: false,
        timeout: 120000,
      },
});
