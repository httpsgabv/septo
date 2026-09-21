import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('server renders the shell with the API status', async ({ request }) => {
  const html = await (await request.get('/notes')).text();
  expect(html).toContain('<h1');
  expect(html).toContain('API online');
});

test('/ opens Notas', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Notas' })).toBeVisible();
});

test('an unknown URL renders the 404 inside the shell', async ({ page }) => {
  await gotoHydrated(page, '/nao-existe');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Página não encontrada' }),
  ).toBeVisible();
  await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
});

test('sidebar navigates between sections and marks the active one', async ({ page }) => {
  await gotoHydrated(page, '/notes');
  const sidebar = page.locator('[data-sidebar="sidebar"]');

  await sidebar.getByRole('link', { name: 'Dev Tools' }).click();
  await expect(page).toHaveURL(/\/dev-tools$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dev Tools' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Dev Tools' })).toHaveAttribute('data-active');
});

test('Dev Tools expands into its six tools, and a tool is one click away', async ({ page }) => {
  await gotoHydrated(page, '/notes');
  const sidebar = page.locator('[data-sidebar="sidebar"]');

  // Outside the tools the group starts closed.
  await expect(sidebar.getByRole('link', { name: 'Chaves RSA' })).toBeHidden();
  await sidebar.getByRole('button', { name: 'Mostrar ferramentas' }).click();
  await sidebar.getByRole('link', { name: 'Chaves RSA' }).click();

  await expect(page).toHaveURL(/\/dev-tools\/rsa$/);
  await expect(sidebar.getByRole('link', { name: 'Chaves RSA' })).toHaveAttribute('data-active');

  await sidebar.getByRole('button', { name: 'Ocultar ferramentas' }).click();
  await expect(sidebar.getByRole('link', { name: 'Chaves RSA' })).toBeHidden();
});

test('command palette reaches a dev tool directly', async ({ page }) => {
  await gotoHydrated(page, '/notes');

  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Buscar no septo' });
  await expect(palette).toBeVisible();
  await page.keyboard.type('rsa');
  await expect(palette.getByRole('option')).toHaveText([/Chaves RSA/]);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/dev-tools\/rsa$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Chaves RSA' })).toBeVisible();
});

test('command palette opens with the shortcut and navigates', async ({ page }) => {
  await gotoHydrated(page, '/notes');

  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Buscar no septo' });
  await expect(palette).toBeVisible();

  await page.keyboard.type('config');
  await expect(palette.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/settings$/);
  await expect(palette).toBeHidden();
});

test.describe('mobile (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('fits the screen and navigates through the drawer', async ({ page }) => {
    await gotoHydrated(page, '/notes');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    await page.getByRole('button', { name: 'Alternar menu lateral' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    await drawer.getByRole('link', { name: 'Dev Tools' }).click();
    await expect(page).toHaveURL(/\/dev-tools$/);
    await expect(drawer).toBeHidden();

    // Inside Dev Tools the drawer shows the tools, and picking one closes it too.
    await page.getByRole('button', { name: 'Alternar menu lateral' }).click();
    await drawer.getByRole('link', { name: 'JSON' }).click();
    await expect(page).toHaveURL(/\/dev-tools\/json$/);
    await expect(drawer).toBeHidden();
  });
});
