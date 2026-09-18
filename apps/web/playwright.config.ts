import { defineConfig, devices } from '@playwright/test';

// Runs against the dev servers (api + web via turbo). Infra must be up: `docker compose up -d`.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The dev server compiles modules on first request; hydration can exceed the 5s default under parallel load.
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    cwd: '../..',
    url: 'http://localhost:5173/notes',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
