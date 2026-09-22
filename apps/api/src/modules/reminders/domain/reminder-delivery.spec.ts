import { describe, expect, it } from 'vitest';
import { ReminderDelivery } from './reminder-delivery.js';

const t0 = new Date('2026-09-22T10:00:00.000Z');
const t1 = new Date('2026-09-22T10:01:00.000Z');
const t5 = new Date('2026-09-22T10:05:00.000Z');
const input = {
  noteId: '7f1c2b3a-0000-4000-8000-000000000001',
  scheduledFor: t0,
  subscriptionId: '7f1c2b3a-0000-4000-8000-000000000002',
};

describe('ReminderDelivery', () => {
  it('starts pending and ready immediately', () => {
    const delivery = ReminderDelivery.create(input, t0);

    expect(delivery).toMatchObject({
      ...input,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: t0,
      lastStatusCode: null,
      sentAt: null,
      createdAt: t0,
      updatedAt: t0,
    });
  });

  it('records a retry and then a successful second attempt', () => {
    const delivery = ReminderDelivery.create(input, t0);

    delivery.scheduleRetry(t1, 503, t0);
    expect(delivery).toMatchObject({
      status: 'retry',
      attempts: 1,
      nextAttemptAt: t1,
      lastStatusCode: 503,
      sentAt: null,
    });

    delivery.recordSent(t5);
    expect(delivery).toMatchObject({
      status: 'sent',
      attempts: 2,
      lastStatusCode: null,
      sentAt: t5,
      updatedAt: t5,
    });
  });

  it('records a network retry without inventing an HTTP status', () => {
    const delivery = ReminderDelivery.create(input, t0);

    delivery.scheduleRetry(t1, undefined, t0);

    expect(delivery.lastStatusCode).toBeNull();
  });

  it('records a permanent failure as a terminal attempted state', () => {
    const delivery = ReminderDelivery.create(input, t0);

    delivery.recordFailed(400, t1);

    expect(delivery).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastStatusCode: 400,
      sentAt: null,
      updatedAt: t1,
    });
  });

  it('cancels without counting an attempt', () => {
    const delivery = ReminderDelivery.create(input, t0);

    delivery.cancel(t1);

    expect(delivery).toMatchObject({ status: 'canceled', attempts: 0, updatedAt: t1 });
  });

  it.each(['sent', 'failed', 'canceled'] as const)(
    'does not allow terminal %s deliveries to transition again',
    (status) => {
      const delivery = ReminderDelivery.create(input, t0);
      if (status === 'sent') delivery.recordSent(t1);
      if (status === 'failed') delivery.recordFailed(400, t1);
      if (status === 'canceled') delivery.cancel(t1);

      expect(() => delivery.scheduleRetry(t5, 503, t5)).toThrow(/terminal/);
      expect(() => delivery.recordSent(t5)).toThrow(/terminal/);
      expect(() => delivery.recordFailed(400, t5)).toThrow(/terminal/);
      expect(() => delivery.cancel(t5)).toThrow(/terminal/);
    },
  );
});
