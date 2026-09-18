import { expect, type Page } from '@playwright/test';

/** Navigates and waits until React has hydrated, so clicks and shortcuts reach live handlers. */
export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'true');
}
