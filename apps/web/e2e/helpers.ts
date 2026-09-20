import { type BrowserContext, expect, type Page } from '@playwright/test';
import { E2E_PASSWORD, E2E_USERNAME } from './constants';

/** Navigates and waits until React has hydrated, so clicks and shortcuts reach live handlers. */
export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'true');
}

/** Signs a browser context in through the API, leaving the session cookie in its jar. */
export async function signInViaApi(context: BrowserContext, password = E2E_PASSWORD) {
  const res = await context.request.post('/api/auth/login', {
    data: { username: E2E_USERNAME, password },
  });
  expect(res.ok()).toBe(true);
}
