import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushPermission } from './domain/push-support';
import type {
  BrowserPushRegistration,
  BrowserPushSubscription,
  PushApi,
  PushRuntime,
} from './push-client';
import { createPushClient } from './push-client';

const publicKey = 'SGVsbG8td29ybGQ';
const json = {
  endpoint: 'https://push.example.test/secret',
  expirationTime: null,
  keys: { p256dh: 'public-key', auth: 'auth-secret' },
};

describe('push client', () => {
  let events: string[];
  let subscription: BrowserPushSubscription;
  let registration: BrowserPushRegistration;
  let api: PushApi;
  let runtime: PushRuntime;

  beforeEach(() => {
    events = [];
    subscription = {
      toJSON: () => json,
      unsubscribe: vi.fn(async () => {
        events.push('browser.unsubscribe');
        return true;
      }),
    };
    registration = {
      getSubscription: vi.fn(async () => null),
      subscribe: vi.fn(async () => subscription),
    };
    api = {
      getConfig: vi.fn(async () => ({ publicKey })),
      upsert: vi.fn(async () => {
        events.push('api.upsert');
        return { id: '7f1c2b3a-0000-4000-8000-000000000001' };
      }),
      delete: vi.fn(async () => {
        events.push('api.delete');
      }),
    };
    runtime = {
      isSupported: () => true,
      getPermission: () => 'default',
      requestPermission: vi.fn(async (): Promise<PushPermission> => 'granted'),
      getRegistration: vi.fn(async () => null),
      register: vi.fn(async () => registration),
    };
  });

  it('asks permission only inside activation, registers, subscribes and upserts', async () => {
    const client = createPushClient(api, runtime);
    expect(runtime.requestPermission).not.toHaveBeenCalled();

    const state = await client.activate();

    expect(runtime.requestPermission).toHaveBeenCalledOnce();
    expect(runtime.register).toHaveBeenCalledOnce();
    expect(api.getConfig).toHaveBeenCalledOnce();
    expect(registration.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([72, 101, 108, 108, 111, 45, 119, 111, 114, 108, 100]),
    });
    expect(api.upsert).toHaveBeenCalledWith(json);
    expect(state).toMatchObject({
      kind: 'enabled',
      subscriptionId: '7f1c2b3a-0000-4000-8000-000000000001',
      subscription,
    });
  });

  it('reconciles an existing granted subscription without requesting permission', async () => {
    runtime.getPermission = () => 'granted';
    runtime.getRegistration = vi.fn(async () => registration);
    registration.getSubscription = vi.fn(async () => subscription);

    const state = await createPushClient(api, runtime).reconcile();

    expect(runtime.requestPermission).not.toHaveBeenCalled();
    expect(registration.subscribe).not.toHaveBeenCalled();
    expect(api.upsert).toHaveBeenCalledWith(json);
    expect(state.kind).toBe('enabled');
  });

  it.each([
    ['unsupported', false, 'default'],
    ['default', true, 'default'],
    ['denied', true, 'denied'],
  ] as const)(
    'reconciles to %s without prompting or calling the API',
    async (kind, supported, permission) => {
      runtime.isSupported = () => supported;
      runtime.getPermission = () => permission;

      await expect(createPushClient(api, runtime).reconcile()).resolves.toEqual({ kind });
      expect(runtime.requestPermission).not.toHaveBeenCalled();
      expect(api.upsert).not.toHaveBeenCalled();
    },
  );

  it('deletes from the API before unsubscribing in the browser', async () => {
    const client = createPushClient(api, runtime);

    await expect(
      client.deactivate({
        kind: 'enabled',
        subscriptionId: '7f1c2b3a-0000-4000-8000-000000000001',
        subscription,
      }),
    ).resolves.toEqual({ kind: 'default' });

    expect(events).toEqual(['api.delete', 'browser.unsubscribe']);
  });

  it('keeps the browser subscription when API deletion fails', async () => {
    api.delete = vi.fn(async () => {
      throw new Error('offline');
    });

    await expect(
      createPushClient(api, runtime).deactivate({
        kind: 'enabled',
        subscriptionId: '7f1c2b3a-0000-4000-8000-000000000001',
        subscription,
      }),
    ).rejects.toThrow('offline');
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });
});
