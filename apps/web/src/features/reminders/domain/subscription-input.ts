import type { PushSubscriptionRequest } from '../../../shared/api/generated/models';

export type BrowserPushSubscriptionJson = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: Record<string, string>;
};

export function toPushSubscriptionInput(
  subscription: BrowserPushSubscriptionJson,
): PushSubscriptionRequest {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('Invalid browser push subscription');
  }
  return {
    endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  };
}

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(`${value}${padding}`.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
