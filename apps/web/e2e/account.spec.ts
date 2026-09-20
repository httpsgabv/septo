import { expect, test } from '@playwright/test';
import { E2E_USERNAME } from './constants';
import { gotoHydrated } from './helpers';

test('Configurações mostra a conta do usuário logado', async ({ page }) => {
  await gotoHydrated(page, '/settings');

  const account = page.locator('section', { hasText: 'Usuário' }).first();
  await expect(account).toContainText(E2E_USERNAME);
  await expect(page.getByRole('heading', { level: 2, name: 'Último login' })).toBeVisible();
  // The global setup signed in, so there is a date (formatted in the browser after hydration).
  await expect(page.locator('time')).not.toHaveText(/^(Nunca)?\s*$/);
});

test('o menu do usuário mostra o nome e oferece Sair', async ({ page }) => {
  await gotoHydrated(page, '/notes');

  await page.getByRole('button', { name: 'Menu do usuário' }).click();

  await expect(page.getByRole('menu')).toContainText(`@${E2E_USERNAME}`);
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
});

test('a página de Configurações não tem overflow horizontal em 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await gotoHydrated(page, '/settings');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
