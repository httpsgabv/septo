import { Inject, Injectable } from '@nestjs/common';
import webPush from 'web-push';
import { ENV, type Env } from '../../../shared/env.js';
import {
  type PushPayload,
  PushSender,
  type PushSendResult,
  type PushSubscriptionTarget,
} from '../domain/push-sender.js';

const PUSH_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class WebPushSender extends PushSender {
  constructor(@Inject(ENV) env: Env) {
    super();
    webPush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  }

  async send(subscription: PushSubscriptionTarget, payload: PushPayload): Promise<PushSendResult> {
    const { topic, ...notification } = payload;

    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(notification),
        { TTL: PUSH_TTL_SECONDS, urgency: 'normal', topic },
      );
      return { kind: 'sent' };
    } catch (error) {
      return classifyFailure(error);
    }
  }
}

function classifyFailure(error: unknown): PushSendResult {
  const statusCode = readStatusCode(error);
  if (statusCode === 404 || statusCode === 410) return { kind: 'gone', statusCode };
  if (statusCode === undefined) return { kind: 'transient' };
  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) {
    return { kind: 'transient', statusCode };
  }
  return { kind: 'permanent', statusCode };
}

function readStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const { statusCode } = error;
  return typeof statusCode === 'number' && Number.isInteger(statusCode) ? statusCode : undefined;
}
