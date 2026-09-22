import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8');

type Listener = (event: Record<string, unknown>) => void;

function loadServiceWorker() {
  const listeners = new Map<string, Listener>();
  const showNotification = vi.fn(async () => undefined);
  const skipWaiting = vi.fn(async () => undefined);
  const claim = vi.fn(async () => undefined);
  const matchAll = vi.fn(async () => [] as Array<Record<string, unknown>>);
  const openWindow = vi.fn(async () => undefined);
  const worker = {
    location: { origin: 'https://septo.test' },
    registration: { showNotification },
    clients: { claim, matchAll, openWindow },
    skipWaiting,
    addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
  };
  runInNewContext(source, { self: worker, URL });
  return { listeners, showNotification, skipWaiting, claim, matchAll, openWindow };
}

async function dispatch(listeners: Map<string, Listener>, name: string, event: object) {
  let pending: Promise<unknown> | undefined;
  listeners.get(name)?.({
    ...event,
    waitUntil: (promise: Promise<unknown>) => (pending = promise),
  });
  await pending;
}

describe('service worker de lembretes', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('ativa imediatamente e assume os clientes', async () => {
    const { listeners, skipWaiting, claim } = loadServiceWorker();

    await dispatch(listeners, 'install', {});
    await dispatch(listeners, 'activate', {});

    expect(skipWaiting).toHaveBeenCalledOnce();
    expect(claim).toHaveBeenCalledOnce();
  });

  it('mostra o payload válido com ícone e URL da nota', async () => {
    const { listeners, showNotification } = loadServiceWorker();

    await dispatch(listeners, 'push', {
      data: {
        json: () => ({
          title: 'Lembrete',
          body: 'Consulta',
          url: '/notes/note-id',
          tag: 'note-note-id',
        }),
      },
    });

    expect(showNotification).toHaveBeenCalledWith('Lembrete', {
      body: 'Consulta',
      icon: '/icons/pwa-192.png',
      badge: '/icons/pwa-192.png',
      tag: 'note-note-id',
      data: { url: '/notes/note-id' },
    });
  });

  it.each([
    ['ausente', undefined],
    [
      'inválido',
      {
        json: () => {
          throw new Error('broken');
        },
      },
    ],
  ])('usa fallbacks seguros com payload %s', async (_label, data) => {
    const { listeners, showNotification } = loadServiceWorker();

    await dispatch(listeners, 'push', { data });

    expect(showNotification).toHaveBeenCalledWith('Lembrete', {
      body: 'Toque para abrir a nota.',
      icon: '/icons/pwa-192.png',
      badge: '/icons/pwa-192.png',
      tag: 'reminder',
      data: { url: '/notes' },
    });
  });

  it('fecha, navega e foca uma janela existente', async () => {
    const focus = vi.fn(async () => undefined);
    const navigate = vi.fn(async () => ({ focus }));
    const { listeners, matchAll, openWindow } = loadServiceWorker();
    matchAll.mockResolvedValue([{ navigate, focus }]);
    const close = vi.fn();

    await dispatch(listeners, 'notificationclick', {
      notification: { close, data: { url: '/notes/note-id' } },
    });

    expect(close).toHaveBeenCalledOnce();
    expect(matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true });
    expect(navigate).toHaveBeenCalledWith('https://septo.test/notes/note-id');
    expect(focus).toHaveBeenCalledOnce();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('abre uma janela e reduz URL externa para /notes', async () => {
    const { listeners, openWindow } = loadServiceWorker();

    await dispatch(listeners, 'notificationclick', {
      notification: { close: vi.fn(), data: { url: 'https://evil.test/steal' } },
    });

    expect(openWindow).toHaveBeenCalledWith('https://septo.test/notes');
  });

  it('não intercepta fetch nem usa cache', () => {
    const { listeners } = loadServiceWorker();

    expect(listeners.has('fetch')).toBe(false);
    expect(source).not.toMatch(/caches\s*\./);
  });
});
