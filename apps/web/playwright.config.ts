import { defineConfig, devices } from '@playwright/test';
import {
  AUTH_FILE,
  BASE_URL,
  E2E_API_PORT,
  E2E_DATABASE_URL,
  E2E_PASSWORD,
  E2E_USERNAME,
  E2E_WEB_PORT,
} from './e2e/constants';

// Starts its own api + web (other ports, database `septo_test`) via turbo. Infra must be up:
// `docker compose up -d`. Servers you already run for development are left alone.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The dev server compiles modules on first request; hydration can exceed the 5s default under parallel load.
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    // Every suite starts signed in; the auth suite opts out with an empty state.
    storageState: AUTH_FILE,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /\.destructive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Suites that end sessions, change the password or rename the user: they would sign out or
      // confuse the parallel suites that share one session, so they run alone, after them.
      name: 'destructive',
      testMatch: /\.destructive\.spec\.ts/,
      dependencies: ['chromium'],
      fullyParallel: false,
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // seed.mjs migrates septo_test and creates the e2e user before anything else touches dist/.
    // Loose env mode: turbo would otherwise hide the variables below from api and web.
    command: 'node apps/web/e2e/seed.mjs && npx turbo run dev --env-mode=loose --ui=stream',
    cwd: '../..',
    url: `${BASE_URL}/notes`,
    reuseExistingServer: false,
    // Lets turbo stop the api and web it started; a hard kill would leave them holding the ports.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    timeout: 180_000,
    env: {
      API_PORT: String(E2E_API_PORT),
      WEB_PORT: String(E2E_WEB_PORT),
      API_INTERNAL_URL: `http://localhost:${E2E_API_PORT}`,
      DATABASE_URL: E2E_DATABASE_URL,
      E2E_DATABASE_URL,
      E2E_USERNAME,
      E2E_PASSWORD,
    },
  },
});
