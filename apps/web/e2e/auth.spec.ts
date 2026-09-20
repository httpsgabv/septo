import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { AUTH_FILE, E2E_PASSWORD, E2E_USERNAME } from './constants';
import { gotoHydrated } from './helpers';

// Same value as DEV_JWT_SECRET in apps/api/src/shared/env.ts (the e2e API runs without NODE_ENV=production).
const DEV_JWT_SECRET = 'septo-dev-only-jwt-secret-never-use-in-production';

const signedOut = { cookies: [], origins: [] };

async function signIn(page: import('@playwright/test').Page, password = E2E_PASSWORD) {
  await page.getByLabel('Usuário').fill(E2E_USERNAME);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('signed out', () => {
  test.use({ storageState: signedOut });

  test('a protected page sends to /login and returns after signing in', async ({ page }) => {
    await page.goto('/notes');

    await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)notes$/);
    await expect(page.getByRole('heading', { level: 1, name: 'septo' })).toBeVisible();
    await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);

    await page.locator('body[data-hydrated]').waitFor();
    await signIn(page);

    await expect(page).toHaveURL(/\/notes$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Notas' })).toBeVisible();
  });

  test('comes back to the page that was asked for, with its query', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login\?redirect=/);
    await page.locator('body[data-hydrated]').waitFor();

    await signIn(page);

    await expect(page).toHaveURL(/\/settings$/);
  });

  test('a wrong password and an unknown user get the same message', async ({ page }) => {
    await gotoHydrated(page, '/login');

    await signIn(page, 'not-the-password-999');
    await expect(page.getByRole('alert')).toHaveText('Usuário ou senha inválidos');
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Usuário').fill('nobody');
    await page.getByLabel('Senha').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toHaveText('Usuário ou senha inválidos');
  });

  test('asks for both fields before calling the API', async ({ page }) => {
    await gotoHydrated(page, '/login');

    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toHaveText('Informe usuário e senha.');
  });

  test('ignores an external ?redirect= and lands on Notas', async ({ page }) => {
    await gotoHydrated(page, '/login?redirect=//evil.com');

    await signIn(page);

    await expect(page).toHaveURL(/\/notes$/);
  });

  test('the server redirects a protected page without rendering the shell', async ({ request }) => {
    const res = await request.get('/notes', { maxRedirects: 0 });

    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers().location).toMatch(/\/login\?redirect=(%2F|\/)notes/);
    expect(await res.text()).not.toContain('data-sidebar');
  });

  test('the API refuses protected calls without a session', async ({ request }) => {
    expect((await request.get('/api/me')).status()).toBe(401);
    expect((await request.get('/api/health')).status()).toBe(200);
  });
});

test.describe('signed in', () => {
  test('/login goes straight to Notas', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/notes$/);
  });

  test('/login ignores a redirect to itself', async ({ page }) => {
    await page.goto('/login?redirect=/login');

    await expect(page).toHaveURL(/\/notes$/);
  });

  test('a session older than 15 days is renewed on a server render', async ({ request }) => {
    const { value } = JSON.parse(readFileSync(AUTH_FILE, 'utf8')).cookies.find(
      (cookie: { name: string }) => cookie.name === 'septo_session',
    );
    const { sub, ver } = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
    const day = 24 * 60 * 60;
    const iat = Math.floor(Date.now() / 1000) - 16 * day;
    const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
    const unsigned = `${encode({ alg: 'HS256' })}.${encode({ ver, sub, iat, exp: iat + 30 * day })}`;
    const old = `${unsigned}.${createHmac('sha256', DEV_JWT_SECRET).update(unsigned).digest('base64url')}`;

    const res = await request.get('/notes', {
      headers: { cookie: `septo_session=${old}` },
      maxRedirects: 0,
    });

    expect(res.status()).toBe(200);
    const renewed = res
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value);
    expect(
      renewed.some((cookie) => cookie.startsWith('septo_session=') && !cookie.includes(old)),
    ).toBe(true);
    expect(renewed.join('\n')).toContain('HttpOnly');
  });
});
