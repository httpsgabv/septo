import { describe, expect, it } from 'vitest';
import { InvalidPushSubscriptionError, PushSubscription } from './push-subscription.js';

const now = new Date('2026-09-22T10:00:00.000Z');
const input = {
  endpoint: 'https://push.example.test/subscriptions/secret',
  p256dh: 'BGlv_2-public-key',
  auth: 'auth-secret_1',
  expirationTime: new Date('2026-10-22T10:00:00.000Z'),
};

describe('PushSubscription', () => {
  it('creates a valid subscription and exposes only its id when serialized', () => {
    const subscription = PushSubscription.create(input, now);

    expect(subscription).toMatchObject({ ...input, createdAt: now, updatedAt: now });
    expect(subscription.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(JSON.stringify(subscription))).toEqual({ id: subscription.id });
  });

  it('restores stored dates and credentials', () => {
    const restored = PushSubscription.restore({
      id: crypto.randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    });

    expect(restored).toMatchObject({ ...input, createdAt: now, updatedAt: now });
  });

  it.each([
    ['an HTTP endpoint', { endpoint: 'http://push.example.test/x' }],
    ['an invalid URL', { endpoint: 'not-a-url' }],
    ['an endpoint over 2048 chars', { endpoint: `https://push.example.test/${'x'.repeat(2025)}` }],
    ['an empty p256dh', { p256dh: '' }],
    ['a non-base64url p256dh', { p256dh: 'not base64!' }],
    ['a p256dh over 256 chars', { p256dh: 'a'.repeat(257) }],
    ['an empty auth secret', { auth: '' }],
    ['a non-base64url auth secret', { auth: 'not base64!' }],
    ['an auth secret over 128 chars', { auth: 'a'.repeat(129) }],
    ['an invalid expiration', { expirationTime: new Date(Number.NaN) }],
  ])('rejects %s', (_case, patch) => {
    expect(() => PushSubscription.create({ ...input, ...patch }, now)).toThrow(
      InvalidPushSubscriptionError,
    );
  });
});
