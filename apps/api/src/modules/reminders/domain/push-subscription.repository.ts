import type { PushSubscription } from './push-subscription.js';

export abstract class PushSubscriptionRepository {
  abstract upsert(subscription: PushSubscription): Promise<PushSubscription>;
  abstract findById(id: string): Promise<PushSubscription | null>;
  abstract listActiveAt(at: Date): Promise<PushSubscription[]>;
  abstract delete(id: string): Promise<void>;
}
