import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEnv } from '../../../shared/env.js';
import type { PushPayload, PushSubscriptionTarget } from '../domain/push-sender.js';
import { WebPushSender } from './web-push.sender.js';

const webPush = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

vi.mock('web-push', () => ({ default: webPush }));

const subscription: PushSubscriptionTarget = {
  endpoint: 'https://push.example.test/subscription/secret',
  p256dh: 'public-key',
  auth: 'auth-secret',
};

const payload: PushPayload = {
  title: 'Lembrete',
  body: 'Comprar café',
  url: '/notes/7f1c2b3a-0000-4000-8000-000000000001',
  tag: 'reminder:7f1c2b3a-0000-4000-8000-000000000001',
  topic: '7f1c2b3a000040008000000000000001',
};

describe('WebPushSender', () => {
  let sender: WebPushSender;

  beforeEach(() => {
    vi.clearAllMocks();
    sender = new WebPushSender(parseEnv({}));
  });

  it('configures VAPID and sends only the public notification payload', async () => {
    webPush.sendNotification.mockResolvedValue({ statusCode: 201 });

    await expect(sender.send(subscription, payload)).resolves.toEqual({ kind: 'sent' });

    expect(webPush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:dev@septo.local',
      expect.stringMatching(/^[A-Za-z0-9_-]{87}$/),
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    );
    expect(webPush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag: payload.tag,
      }),
      { TTL: 86_400, urgency: 'normal', topic: payload.topic },
    );
  });

  it.each([404, 410])('classifies HTTP %i as gone', async (statusCode) => {
    webPush.sendNotification.mockRejectedValue(
      Object.assign(new Error('push failed'), { statusCode }),
    );

    await expect(sender.send(subscription, payload)).resolves.toEqual({ kind: 'gone', statusCode });
  });

  it.each([408, 429, 500, 503])('classifies HTTP %i as transient', async (statusCode) => {
    webPush.sendNotification.mockRejectedValue(
      Object.assign(new Error('push failed'), { statusCode }),
    );

    await expect(sender.send(subscription, payload)).resolves.toEqual({
      kind: 'transient',
      statusCode,
    });
  });

  it('classifies a network error as transient without a status code', async () => {
    webPush.sendNotification.mockRejectedValue(new Error('socket closed'));

    await expect(sender.send(subscription, payload)).resolves.toEqual({ kind: 'transient' });
  });

  it.each([400, 401, 403, 413])('classifies HTTP %i as permanent', async (statusCode) => {
    webPush.sendNotification.mockRejectedValue(
      Object.assign(new Error('push failed'), { statusCode }),
    );

    await expect(sender.send(subscription, payload)).resolves.toEqual({
      kind: 'permanent',
      statusCode,
    });
  });
});
