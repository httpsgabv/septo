import { type ReminderCandidate, ReminderSource } from '../../notes/domain/reminder-source.js';
import type { PushPayload, PushSendResult, PushSubscriptionTarget } from '../domain/push-sender.js';
import { PushSender } from '../domain/push-sender.js';
import { PushSubscription } from '../domain/push-subscription.js';
import { PushSubscriptionRepository } from '../domain/push-subscription.repository.js';
import { ReminderDelivery } from '../domain/reminder-delivery.js';
import { ReminderDeliveryRepository } from '../domain/reminder-delivery.repository.js';

export class InMemoryReminderSource extends ReminderSource {
  readonly candidates: ReminderCandidate[] = [];
  readonly current = new Map<string, ReminderCandidate>();
  lastListInput: { after: Date; through: Date; limit: number } | undefined;

  constructor(readonly events: string[] = []) {
    super();
  }

  add(candidate: ReminderCandidate) {
    this.candidates.push(candidate);
    this.current.set(candidate.id, candidate);
  }

  listDue(input: { after: Date; through: Date; limit: number }) {
    this.events.push('source.listDue');
    this.lastListInput = input;
    return Promise.resolve(
      this.candidates
        .filter(
          ({ remindAt, updatedAt }) =>
            remindAt > input.after && remindAt <= input.through && updatedAt < remindAt,
        )
        .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
        .slice(0, input.limit),
    );
  }

  findCurrent(id: string, scheduledFor: Date) {
    this.events.push('source.findCurrent');
    const candidate = this.current.get(id);
    if (
      !candidate ||
      candidate.remindAt.getTime() !== scheduledFor.getTime() ||
      candidate.updatedAt >= candidate.remindAt
    ) {
      return Promise.resolve(null);
    }
    return Promise.resolve(candidate);
  }
}

export class InMemoryPushSubscriptionRepository extends PushSubscriptionRepository {
  readonly records = new Map<string, PushSubscription>();
  onDelete: (id: string) => void = () => undefined;

  constructor(readonly events: string[] = []) {
    super();
  }

  get items() {
    return [...this.records.values()];
  }

  upsert(subscription: PushSubscription) {
    const existing = this.items.find(({ endpoint }) => endpoint === subscription.endpoint);
    const stored = existing
      ? PushSubscription.restore({
          id: existing.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          expirationTime: subscription.expirationTime,
          createdAt: existing.createdAt,
          updatedAt: subscription.updatedAt,
        })
      : subscription;
    this.records.set(stored.id, stored);
    return Promise.resolve(stored);
  }

  findById(id: string) {
    this.events.push('subscriptions.findById');
    return Promise.resolve(this.records.get(id) ?? null);
  }

  listActiveAt(at: Date) {
    this.events.push('subscriptions.listActiveAt');
    return Promise.resolve(
      this.items.filter(
        ({ expirationTime }) => expirationTime === null || expirationTime.getTime() > at.getTime(),
      ),
    );
  }

  delete(id: string) {
    if (this.records.delete(id)) this.onDelete(id);
    return Promise.resolve();
  }
}

export class InMemoryReminderDeliveryRepository extends ReminderDeliveryRepository {
  readonly records = new Map<string, ReminderDelivery>();
  readonly unique = new Map<string, string>();

  constructor(readonly events: string[] = []) {
    super();
  }

  get items() {
    return [...this.records.values()];
  }

  materialize(deliveries: readonly ReminderDelivery[]) {
    this.events.push('deliveries.materialize');
    for (const delivery of deliveries) {
      const key = `${delivery.noteId}:${delivery.scheduledFor.toISOString()}:${delivery.subscriptionId}`;
      if (this.unique.has(key)) continue;
      this.unique.set(key, delivery.id);
      this.records.set(delivery.id, delivery);
    }
    return Promise.resolve();
  }

  listReady(now: Date, limit: number) {
    this.events.push('deliveries.listReady');
    return Promise.resolve(
      this.items
        .filter(
          ({ status, nextAttemptAt }) =>
            (status === 'pending' || status === 'retry') && nextAttemptAt <= now,
        )
        .sort(
          (a, b) =>
            a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime() ||
            a.scheduledFor.getTime() - b.scheduledFor.getTime() ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        )
        .slice(0, limit),
    );
  }

  save(delivery: ReminderDelivery) {
    this.events.push('deliveries.save');
    this.records.set(delivery.id, delivery);
    return Promise.resolve();
  }

  deleteBySubscription(subscriptionId: string) {
    for (const delivery of this.items) {
      if (delivery.subscriptionId !== subscriptionId) continue;
      this.records.delete(delivery.id);
      const key = `${delivery.noteId}:${delivery.scheduledFor.toISOString()}:${delivery.subscriptionId}`;
      this.unique.delete(key);
    }
  }
}

export class FakePushSender extends PushSender {
  readonly results: PushSendResult[] = [];
  readonly calls: { subscription: PushSubscriptionTarget; payload: PushPayload }[] = [];

  constructor(readonly events: string[] = []) {
    super();
  }

  send(subscription: PushSubscriptionTarget, payload: PushPayload): Promise<PushSendResult> {
    this.events.push('sender.send');
    this.calls.push({ subscription, payload });
    return Promise.resolve(this.results.shift() ?? { kind: 'sent' });
  }
}
