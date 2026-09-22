import { describe, expect, it } from 'vitest';
import { resolvePushState, supportsWebPush } from './push-support';

describe('supportsWebPush', () => {
  it('requires service worker, PushManager and Notification', () => {
    expect(supportsWebPush({ serviceWorker: true, pushManager: true, notification: true })).toBe(
      true,
    );
    expect(supportsWebPush({ serviceWorker: false, pushManager: true, notification: true })).toBe(
      false,
    );
    expect(supportsWebPush({ serviceWorker: true, pushManager: false, notification: true })).toBe(
      false,
    );
    expect(supportsWebPush({ serviceWorker: true, pushManager: true, notification: false })).toBe(
      false,
    );
  });
});

describe('resolvePushState', () => {
  it.each([
    [{ supported: false, permission: 'default', hasSubscription: false }, 'unsupported'],
    [{ supported: true, permission: 'default', hasSubscription: false }, 'default'],
    [{ supported: true, permission: 'denied', hasSubscription: false }, 'denied'],
    [{ supported: true, permission: 'granted', hasSubscription: false }, 'default'],
    [{ supported: true, permission: 'granted', hasSubscription: true }, 'enabled'],
  ] as const)('maps %o to %s', (input, expected) => {
    expect(resolvePushState(input)).toBe(expected);
  });
});
