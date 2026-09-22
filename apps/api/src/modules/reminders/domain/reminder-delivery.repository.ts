import type { ReminderDelivery } from './reminder-delivery.js';

export abstract class ReminderDeliveryRepository {
  abstract materialize(deliveries: readonly ReminderDelivery[]): Promise<void>;
  abstract listReady(now: Date, limit: number): Promise<ReminderDelivery[]>;
  abstract save(delivery: ReminderDelivery): Promise<void>;
}
