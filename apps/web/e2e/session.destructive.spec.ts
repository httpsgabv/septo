import { expect, test } from '@playwright/test';
import { BASE_URL, E2E_PASSWORD, E2E_USERNAME } from './constants';
import { gotoHydrated, signInViaApi } from './helpers';

const signedOut = { cookies: [], origins: [] };
const NEW_PASSWORD = 'another-e2e-password-456';

// Each test starts from its own fresh sign-in; they never rely on the shared storageState.
test.use({ storageState: signedOut });
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ context }) => {
  await signInViaApi(context);
});

test('Sair encerra a sessão deste navegador', async ({ page }) => {
  await gotoHydrated(page, '/notes');

  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/notes');
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test('editar o nome de exibição atualiza o menu e persiste', async ({ page }) => {
  await gotoHydrated(page, '/settings');

  const field = page.getByRole('textbox', { name: 'Nome de exibição' });
  await field.fill('Gabriel E2E');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Salvo.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu do usuário' })).toContainText('Gabriel E2E');

  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('button', { name: 'Menu do usuário' })).toContainText('Gabriel E2E');

  await field.fill(E2E_USERNAME);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Salvo.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu do usuário' })).toContainText(E2E_USERNAME);
});

test('um nome inválido é recusado no formulário', async ({ page }) => {
  await gotoHydrated(page, '/settings');

  await page.getByRole('textbox', { name: 'Nome de exibição' }).fill(' com espaço ');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'sem espaços' })).toBeVisible();
});

test('trocar a senha mantém este navegador e derruba o outro', async ({ page, browser }) => {
  const other = await browser.newContext({ baseURL: BASE_URL, storageState: signedOut });
  await signInViaApi(other);
  const otherPage = await other.newPage();
  await gotoHydrated(otherPage, '/notes');

  await gotoHydrated(page, '/settings');
  await page.getByLabel('Senha atual').fill('not-the-current-password');
  await page.getByLabel(/^Nova senha/).fill(NEW_PASSWORD);
  await page.getByLabel('Repita a nova senha').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Trocar senha' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'A senha atual' })).toBeVisible();

  await page.getByLabel('Senha atual').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Trocar senha' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Senha alterada' })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/settings$/); // this browser is still signed in
  await otherPage.reload();
  await expect(otherPage).toHaveURL(/\/login\?redirect=/); // the other one is not
  await other.close();

  // Put the original password back for the tests that follow.
  await page.getByLabel('Senha atual').fill(NEW_PASSWORD);
  await page.getByLabel(/^Nova senha/).fill(E2E_PASSWORD);
  await page.getByLabel('Repita a nova senha').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Trocar senha' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Senha alterada' })).toBeVisible();
});

test('a confirmação da nova senha precisa bater', async ({ page }) => {
  await gotoHydrated(page, '/settings');

  await page.getByLabel('Senha atual').fill(E2E_PASSWORD);
  await page.getByLabel(/^Nova senha/).fill(NEW_PASSWORD);
  await page.getByLabel('Repita a nova senha').fill('something-else-entirely');
  await page.getByRole('button', { name: 'Trocar senha' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'A confirmação é diferente' }),
  ).toBeVisible();
});

test('Sair de todos os dispositivos pede confirmação e derruba todas as sessões', async ({
  page,
  browser,
}) => {
  const other = await browser.newContext({ baseURL: BASE_URL, storageState: signedOut });
  await signInViaApi(other);
  const otherPage = await other.newPage();
  await gotoHydrated(otherPage, '/notes');

  await gotoHydrated(page, '/settings');
  await page.getByRole('button', { name: 'Sair de todos' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/settings$/); // cancelled: nothing happened

  await page.getByRole('button', { name: 'Sair de todos' }).click();
  await page.getByRole('button', { name: 'Sim, sair de todos' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await otherPage.reload();
  await expect(otherPage).toHaveURL(/\/login\?redirect=/);
  await other.close();
});

test('uma sessão que expira no meio do uso leva ao login e volta para a página', async ({
  page,
  context,
}) => {
  await gotoHydrated(page, '/settings');

  await context.clearCookies(); // as if it had expired
  await page.getByRole('textbox', { name: 'Nome de exibição' }).fill('qualquer');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)settings$/);
  await expect(page.getByLabel('Usuário')).toBeVisible();
});

test('o login continua funcionando com a senha original depois de tudo', async ({ page }) => {
  await page.context().clearCookies();
  await gotoHydrated(page, '/login');

  await page.getByLabel('Usuário').fill(E2E_USERNAME);
  await page.getByLabel('Senha').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/notes$/);
});
