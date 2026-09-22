import { describe, expect, it } from 'vitest';
import { toPushSubscriptionInput, urlBase64ToUint8Array } from './subscription-input';

describe('toPushSubscriptionInput', () => {
  it('maps the browser JSON shape to the API request', () => {
    expect(
      toPushSubscriptionInput({
        endpoint: 'https://push.example.test/secret',
        expirationTime: 123,
        keys: { p256dh: 'public-key', auth: 'auth-secret', ignored: 'x' },
      }),
    ).toEqual({
      endpoint: 'https://push.example.test/secret',
      expirationTime: 123,
      keys: { p256dh: 'public-key', auth: 'auth-secret' },
    });
  });

  it('normalizes an omitted expiration to null', () => {
    expect(
      toPushSubscriptionInput({
        endpoint: 'https://push.example.test/secret',
        keys: { p256dh: 'public-key', auth: 'auth-secret' },
      }).expirationTime,
    ).toBeNull();
  });

  it('rejects an incomplete browser serialization', () => {
    expect(() => toPushSubscriptionInput({ endpoint: 'x', keys: {} })).toThrow(
      /Invalid browser push subscription/,
    );
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes an unpadded URL-safe VAPID key', () => {
    expect([...urlBase64ToUint8Array('SGVsbG8td29ybGQ')]).toEqual([
      72, 101, 108, 108, 111, 45, 119, 111, 114, 108, 100,
    ]);
  });
});
