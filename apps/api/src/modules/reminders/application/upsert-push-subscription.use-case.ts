import { Injectable } from '@nestjs/common';
import { PushSubscription } from '../domain/push-subscription.js';
import { PushSubscriptionRepository } from '../domain/push-subscription.repository.js';

export type UpsertPushSubscriptionInput = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

@Injectable()
export class UpsertPushSubscriptionUseCase {
  now = () => new Date();

  constructor(private readonly subscriptions: PushSubscriptionRepository) {}

  async execute(input: UpsertPushSubscriptionInput) {
    const now = this.now();
    const subscription = PushSubscription.create(
      {
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        expirationTime: input.expirationTime === null ? null : new Date(input.expirationTime),
      },
      now,
    );
    const stored = await this.subscriptions.upsert(subscription);
    return { id: stored.id };
  }
}
