import { Injectable } from '@nestjs/common';
import { ReminderSource } from '../../notes/domain/reminder-source.js';
import { buildReminderNotification } from '../domain/notification-copy.js';
import { PushSender } from '../domain/push-sender.js';
import { PushSubscriptionRepository } from '../domain/push-subscription.repository.js';
import { ReminderDelivery } from '../domain/reminder-delivery.js';
import { ReminderDeliveryRepository } from '../domain/reminder-delivery.repository.js';

export const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const DISPATCH_BATCH_SIZE = 100;
const FIRST_RETRY_DELAY_MS = 60_000;
const SECOND_RETRY_DELAY_MS = 5 * 60_000;
const MAX_ATTEMPTS = 3;

export type DispatchSummary = {
  candidates: number;
  ready: number;
  sent: number;
  retried: number;
  failed: number;
  canceled: number;
  subscriptionsRemoved: number;
};

@Injectable()
export class DispatchDueRemindersUseCase {
  constructor(
    private readonly source: ReminderSource,
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly deliveries: ReminderDeliveryRepository,
    private readonly sender: PushSender,
  ) {}

  async execute(now = new Date()): Promise<DispatchSummary> {
    const candidates = await this.source.listDue({
      after: new Date(now.getTime() - RECOVERY_WINDOW_MS),
      through: now,
      limit: DISPATCH_BATCH_SIZE,
    });
    const subscriptions = await this.subscriptions.listActiveAt(now);
    const newDeliveries = candidates.flatMap((candidate) =>
      subscriptions
        .filter(({ createdAt }) => createdAt <= candidate.remindAt)
        .map(({ id: subscriptionId }) =>
          ReminderDelivery.create(
            { noteId: candidate.id, scheduledFor: candidate.remindAt, subscriptionId },
            now,
          ),
        ),
    );
    await this.deliveries.materialize(newDeliveries);

    const ready = await this.deliveries.listReady(now, DISPATCH_BATCH_SIZE);
    const summary: DispatchSummary = {
      candidates: candidates.length,
      ready: ready.length,
      sent: 0,
      retried: 0,
      failed: 0,
      canceled: 0,
      subscriptionsRemoved: 0,
    };

    for (const delivery of ready) {
      const note = await this.source.findCurrent(delivery.noteId, delivery.scheduledFor);
      if (!note) {
        delivery.cancel(now);
        await this.deliveries.save(delivery);
        summary.canceled += 1;
        continue;
      }

      const subscription = await this.subscriptions.findById(delivery.subscriptionId);
      if (!subscription) continue;
      if (subscription.expirationTime && subscription.expirationTime <= now) {
        await this.subscriptions.delete(subscription.id);
        summary.subscriptionsRemoved += 1;
        continue;
      }

      const result = await this.sender.send(subscription, buildReminderNotification(note));
      if (result.kind === 'gone') {
        await this.subscriptions.delete(subscription.id);
        summary.subscriptionsRemoved += 1;
      } else if (result.kind === 'sent') {
        delivery.recordSent(now);
        await this.deliveries.save(delivery);
        summary.sent += 1;
      } else if (result.kind === 'permanent' || delivery.attempts >= MAX_ATTEMPTS - 1) {
        delivery.recordFailed(result.statusCode, now);
        await this.deliveries.save(delivery);
        summary.failed += 1;
      } else {
        const delay = delivery.attempts === 0 ? FIRST_RETRY_DELAY_MS : SECOND_RETRY_DELAY_MS;
        delivery.scheduleRetry(new Date(now.getTime() + delay), result.statusCode, now);
        await this.deliveries.save(delivery);
        summary.retried += 1;
      }
    }

    return summary;
  }
}
