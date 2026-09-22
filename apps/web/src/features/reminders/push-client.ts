import {
  pushDeleteSubscription,
  pushGetConfig,
  pushUpsertSubscription,
} from '../../shared/api/generated/endpoints/push/push';
import type { PushSubscriptionRequest } from '../../shared/api/generated/models';
import { type PushPermission, resolvePushState, supportsWebPush } from './domain/push-support';
import {
  type BrowserPushSubscriptionJson,
  toPushSubscriptionInput,
  urlBase64ToUint8Array,
} from './domain/subscription-input';

export interface BrowserPushSubscription {
  toJSON(): BrowserPushSubscriptionJson;
  unsubscribe(): Promise<boolean>;
}

export interface BrowserPushRegistration {
  getSubscription(): Promise<BrowserPushSubscription | null>;
  subscribe(options: {
    userVisibleOnly: true;
    applicationServerKey: Uint8Array<ArrayBuffer>;
  }): Promise<BrowserPushSubscription>;
}

export interface PushRuntime {
  isSupported(): boolean;
  getPermission(): PushPermission;
  requestPermission(): Promise<PushPermission>;
  getRegistration(): Promise<BrowserPushRegistration | null>;
  register(): Promise<BrowserPushRegistration>;
}

export interface PushApi {
  getConfig(): Promise<{ publicKey: string }>;
  upsert(input: PushSubscriptionRequest): Promise<{ id: string }>;
  delete(id: string): Promise<void>;
}

export type PushClientState =
  | { kind: 'unsupported' | 'default' | 'denied' }
  | {
      kind: 'enabled';
      subscriptionId: string;
      subscription: BrowserPushSubscription;
    };

export function createPushClient(api: PushApi, runtime: PushRuntime) {
  const link = async (subscription: BrowserPushSubscription): Promise<PushClientState> => {
    const { id } = await api.upsert(toPushSubscriptionInput(subscription.toJSON()));
    return { kind: 'enabled', subscriptionId: id, subscription };
  };

  return {
    async reconcile(): Promise<PushClientState> {
      const supported = runtime.isSupported();
      const permission = supported ? runtime.getPermission() : 'default';
      const kind = resolvePushState({ supported, permission, hasSubscription: false });
      if (kind === 'unsupported' || kind === 'denied') return { kind };
      if (permission !== 'granted') return { kind: 'default' };

      const registration = await runtime.getRegistration();
      const subscription = await registration?.getSubscription();
      return subscription ? link(subscription) : { kind: 'default' };
    },

    async activate(): Promise<PushClientState> {
      if (!runtime.isSupported()) return { kind: 'unsupported' };
      let permission = runtime.getPermission();
      if (permission === 'default') permission = await runtime.requestPermission();
      if (permission !== 'granted') return { kind: permission === 'denied' ? 'denied' : 'default' };

      const registration = await runtime.register();
      let subscription = await registration.getSubscription();
      if (!subscription) {
        const { publicKey } = await api.getConfig();
        subscription = await registration.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      return link(subscription);
    },

    async deactivate(
      state: Extract<PushClientState, { kind: 'enabled' }>,
    ): Promise<PushClientState> {
      await api.delete(state.subscriptionId);
      await state.subscription.unsubscribe();
      return { kind: 'default' };
    },
  };
}

const generatedApi: PushApi = {
  getConfig: () => pushGetConfig(),
  upsert: (input) => pushUpsertSubscription(input),
  delete: (id) => pushDeleteSubscription(id),
};

export function createBrowserPushClient() {
  return createPushClient(generatedApi, browserRuntime);
}

const browserRuntime: PushRuntime = {
  isSupported: () =>
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    supportsWebPush({
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      notification: 'Notification' in window,
    }),
  getPermission: () => Notification.permission,
  requestPermission: () => Notification.requestPermission(),
  async getRegistration() {
    const registration = await navigator.serviceWorker.getRegistration('/');
    return registration ? wrapRegistration(registration) : null;
  },
  async register() {
    return wrapRegistration(await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
  },
};

function wrapRegistration(registration: ServiceWorkerRegistration): BrowserPushRegistration {
  return {
    async getSubscription() {
      const subscription = await registration.pushManager.getSubscription();
      return subscription ? wrapSubscription(subscription) : null;
    },
    async subscribe(options) {
      const subscription = await registration.pushManager.subscribe({
        ...options,
        applicationServerKey: options.applicationServerKey.buffer,
      });
      return wrapSubscription(subscription);
    },
  };
}

function wrapSubscription(subscription: PushSubscription): BrowserPushSubscription {
  return {
    toJSON: () => subscription.toJSON(),
    unsubscribe: () => subscription.unsubscribe(),
  };
}
