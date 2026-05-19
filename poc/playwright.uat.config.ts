import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/uat-screenshots',
  fullyParallel: false, // Serializar para evitar contention de DB
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium-browser',
        },
      },
    },
  ],
});
