import { expect, test } from '@playwright/test';

const html = (page: import('@playwright/test').Page) => page.locator('html');

test('theme and accent apply immediately and survive a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/settings');
  await expect(page.getByRole('radio', { name: 'Sistema' })).toBeChecked(); // hydrated, defaults
  await expect(html(page)).not.toHaveClass(/dark/);

  await page.getByText('Escuro', { exact: true }).click();
  await page.getByTitle('Esmeralda').click();
  await expect(html(page)).toHaveClass(/dark/);
  await expect(html(page)).toHaveCSS('--accent-base', '#059669');

  // The inline head script applies the stored choice before the app hydrates.
  await page.goto('/notes', { waitUntil: 'domcontentloaded' });
  await expect(html(page)).toHaveClass(/dark/);
  await expect(html(page)).toHaveCSS('--accent-base', '#059669');
});

test('"Sistema" follows the OS color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/notes');
  await expect(html(page)).toHaveClass(/dark/);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html(page)).not.toHaveClass(/dark/);
});

test('corrupt stored preferences fall back to the defaults', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('septo:preferences', '{broken'));
  await page.goto('/settings');
  await expect(page.getByRole('radio', { name: 'Sistema' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Roxo septo' })).toBeChecked();
  await expect(html(page)).toHaveCSS('--accent-base', '#5808a3');
});
