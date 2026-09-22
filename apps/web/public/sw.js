const DEFAULT_NOTIFICATION = {
  title: 'Lembrete',
  body: 'Toque para abrir a nota.',
  url: '/notes',
  tag: 'reminder',
};
const ICON_URL = '/icons/pwa-192.png';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const payload = readPayload(event.data);
  const title = textOr(payload.title, DEFAULT_NOTIFICATION.title);
  const options = {
    body: textOr(payload.body, DEFAULT_NOTIFICATION.body),
    icon: ICON_URL,
    badge: ICON_URL,
    tag: textOr(payload.tag, DEFAULT_NOTIFICATION.tag),
    data: { url: textOr(payload.url, DEFAULT_NOTIFICATION.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openNotification(event.notification.data?.url));
});

function readPayload(data) {
  if (!data) return {};
  try {
    const value = data.json();
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function textOr(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function sameOriginUrl(value) {
  try {
    const target = new URL(textOr(value, DEFAULT_NOTIFICATION.url), self.location.origin);
    if (target.origin === self.location.origin) return target.href;
  } catch {
    // Fall through to the safe notes page.
  }
  return new URL(DEFAULT_NOTIFICATION.url, self.location.origin).href;
}

async function openNotification(rawUrl) {
  const url = sameOriginUrl(rawUrl);
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = windows[0];
  if (!existing) return self.clients.openWindow(url);

  const navigated = typeof existing.navigate === 'function' ? await existing.navigate(url) : null;
  const target = navigated || existing;
  if (typeof target.focus === 'function') return target.focus();
}
