import { z } from 'zod';
import {
  AUTH_MAX_LENGTH,
  P256DH_MAX_LENGTH,
  PUSH_ENDPOINT_MAX_LENGTH,
} from '../domain/push-subscription.js';

const base64Url = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9_-]+$/);

export const pushConfigResponse = z.object({ publicKey: z.string() }).meta({ id: 'PushConfig' });
export type PushConfigResponse = z.infer<typeof pushConfigResponse>;

export const pushSubscriptionRequest = z
  .object({
    endpoint: z.url({ protocol: /^https$/ }).max(PUSH_ENDPOINT_MAX_LENGTH),
    expirationTime: z.number().finite().nullable(),
    keys: z.object({
      p256dh: base64Url(P256DH_MAX_LENGTH),
      auth: base64Url(AUTH_MAX_LENGTH),
    }),
  })
  .meta({ id: 'PushSubscriptionRequest' });
export type PushSubscriptionRequest = z.infer<typeof pushSubscriptionRequest>;

export const pushSubscriptionResponse = z.object({ id: z.uuid() }).meta({ id: 'PushSubscription' });
export type PushSubscriptionResponse = z.infer<typeof pushSubscriptionResponse>;

export const pushSubscriptionParams = z.object({ id: z.uuid() });
export type PushSubscriptionParams = z.infer<typeof pushSubscriptionParams>;
