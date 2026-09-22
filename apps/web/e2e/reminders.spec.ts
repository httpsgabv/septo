import { runInNewContext } from 'node:vm';
import { expect, type Page, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

const SUBSCRIPTION = {
  endpoint: 'https://push.example.test/e2e-browser',
  expirationTime: null,
  keys: { p256dh: 'e2e-public-key', auth: 'e2e-auth-secret' },
};

async function installPushMock(page: Page, initialPermission: NotificationPermission = 'default') {
  await page.addInitScript(
    ({ permission, subscription }) => {
      const increment = (key: string) => {
        localStorage.setItem(key, String(Number(localStorage.getItem(key) ?? 0) + 1));
      };
      const browserSubscription = {
        toJSON: () => subscription,
        unsubscribe: async () => {
          increment('e2e:unsubscribe-count');
          localStorage.removeItem('e2e:push-active');
          return true;
        },
      };
      const registration = {
        pushManager: {
          getSubscription: async () =>
            localStorage.getItem('e2e:push-active') ? browserSubscription : null,
          subscribe: async (options: {
            userVisibleOnly: boolean;
            applicationServerKey: ArrayBuffer;
          }) => {
            increment('e2e:subscribe-count');
            localStorage.setItem('e2e:user-visible', String(options.userVisibleOnly));
            localStorage.setItem(
              'e2e:application-key-length',
              String(new Uint8Array(options.applicationServerKey).length),
            );
            localStorage.setItem('e2e:push-active', 'true');
            return browserSubscription;
          },
        },
      };
      function MockNotification() {}
      Object.defineProperties(MockNotification, {
        permission: {
          get: () => localStorage.getItem('e2e:permission') ?? permission,
        },
        requestPermission: {
          value: async () => {
            increment('e2e:permission-count');
            localStorage.setItem('e2e:permission', 'granted');
            return 'granted';
          },
        },
      });

      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: MockNotification,
      });
      Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          getRegistration: async () => registration,
          register: async () => {
            increment('e2e:register-count');
            return registration;
          },
        },
      });
    },
    { permission: initialPermission, subscription: SUBSCRIPTION },
  );
}

async function mockPushApi(page: Page) {
  const upserts: unknown[] = [];
  const deletes: string[] = [];
  await page.route('**/api/push/**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({ status: 200, json: { publicKey: 'SGVsbG8td29ybGQ' } });
    }
    if (request.method() === 'PUT') {
      upserts.push(request.postDataJSON());
      return route.fulfill({
        status: 200,
        json: { id: '7f1c2b3a-0000-4000-8000-000000000001' },
      });
    }
    deletes.push(request.url());
    return route.fulfill({ status: 204 });
  });
  return { upserts, deletes };
}

const storedNumber = (page: Page, key: string) =>
  page.evaluate((name) => Number(localStorage.getItem(name) ?? 0), key);

test('ativa por clique, envia o DTO, reconcilia no reload e desativa', async ({ page }) => {
  await installPushMock(page);
  const api = await mockPushApi(page);
  await gotoHydrated(page, '/settings');

  await expect(page.getByRole('button', { name: 'Ativar notificações' })).toBeVisible();
  expect(await storedNumber(page, 'e2e:permission-count')).toBe(0);
  expect(api.upserts).toHaveLength(0);

  await page.getByRole('button', { name: 'Ativar notificações' }).click();
  await expect(page.getByText('Ativas neste navegador.')).toBeVisible();
  await expect.poll(() => api.upserts.length).toBe(1);
  expect(api.upserts[0]).toEqual(SUBSCRIPTION);
  expect(await storedNumber(page, 'e2e:permission-count')).toBe(1);
  expect(await storedNumber(page, 'e2e:subscribe-count')).toBe(1);
  expect(await storedNumber(page, 'e2e:application-key-length')).toBe(11);
  expect(await page.evaluate(() => localStorage.getItem('e2e:user-visible'))).toBe('true');

  await page.reload();
  await expect(page.getByText('Ativas neste navegador.')).toBeVisible();
  await expect.poll(() => api.upserts.length).toBe(2);
  expect(await storedNumber(page, 'e2e:permission-count')).toBe(1);
  expect(await storedNumber(page, 'e2e:subscribe-count')).toBe(1);

  await page.getByRole('button', { name: 'Desativar' }).click();
  await expect(page.getByRole('button', { name: 'Ativar notificações' })).toBeVisible();
  expect(api.deletes).toEqual([
    expect.stringContaining('/api/push/subscriptions/7f1c2b3a-0000-4000-8000-000000000001'),
  ]);
  expect(await storedNumber(page, 'e2e:unsubscribe-count')).toBe(1);
});

test('mostra a permissão bloqueada sem pedir novamente', async ({ page }) => {
  await installPushMock(page, 'denied');
  await mockPushApi(page);
  await gotoHydrated(page, '/settings');

  await expect(page.getByText(/notificações estão bloqueadas/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ativar notificações' })).toHaveCount(0);
  expect(await storedNumber(page, 'e2e:permission-count')).toBe(0);
});

test('explica a instalação quando as APIs não existem', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'Notification');
    Reflect.deleteProperty(window, 'PushManager');
  });
  await gotoHydrated(page, '/settings');

  await expect(page.getByText('Indisponível neste navegador.')).toBeVisible();
  await expect(page.getByText(/Adicionar à Tela de Início/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ativar notificações' })).toHaveCount(0);
});

test('entrega manifest, worker e ícones e registra o escopo raiz', async ({ page, request }) => {
  const manifestResponse = await request.get('/app.webmanifest');
  expect(manifestResponse.status()).toBe(200);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  await expect(manifestResponse.json()).resolves.toMatchObject({
    id: '/',
    start_url: '/notes',
    scope: '/',
    display: 'standalone',
  });

  for (const asset of [
    '/sw.js',
    '/icons/pwa-192.png',
    '/icons/pwa-512.png',
    '/icons/pwa-maskable-512.png',
    '/icons/apple-touch-180.png',
  ]) {
    expect((await request.get(asset)).status(), asset).toBe(200);
  }

  await gotoHydrated(page, '/settings');
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).scope))
    .toBe('http://localhost:5273/');
  expect(await page.evaluate(async () => caches.keys())).toEqual([]);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/app.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/icons/apple-touch-180.png',
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#5808a3');
});

test('notificationclick simulado navega para a nota e recusa origem externa', async ({
  request,
}) => {
  const source = await (await request.get('/sw.js')).text();
  let listener: ((event: Record<string, unknown>) => void) | undefined;
  let navigated = '';
  let focused = false;
  const navigate = async (url: string) => {
    navigated = url;
    return {
      focus: async () => {
        focused = true;
      },
    };
  };
  const openWindow = async (url: string) => url;
  const self = {
    location: { origin: 'https://septo.test' },
    clients: {
      matchAll: async () => [{ navigate, focus: async () => undefined }],
      openWindow,
    },
    addEventListener: (name: string, callback: typeof listener) => {
      if (name === 'notificationclick') listener = callback;
    },
  };
  runInNewContext(source, { self, URL });
  let pending: Promise<unknown> | undefined;
  listener?.({
    notification: { close: () => undefined, data: { url: '/notes/note-id' } },
    waitUntil: (promise: Promise<unknown>) => (pending = promise),
  });
  await pending;
  expect(navigated).toBe('https://septo.test/notes/note-id');
  expect(focused).toBe(true);

  self.clients.matchAll = async () => [];
  let opened = '';
  self.clients.openWindow = async (url: string) => (opened = url);
  pending = undefined;
  listener?.({
    notification: { close: () => undefined, data: { url: 'https://evil.test/steal' } },
    waitUntil: (promise: Promise<unknown>) => (pending = promise),
  });
  await pending;
  expect(opened).toBe('https://septo.test/notes');
});
