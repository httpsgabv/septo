import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../../shared/env.js';
import { PrismaService } from '../../../shared/prisma.service.js';
import { ReminderDelivery } from '../domain/reminder-delivery.js';
import { PrismaReminderDeliveryRepository } from './reminder-delivery.prisma-repository.js';

const prisma = new PrismaService(loadEnv());
const repository = new PrismaReminderDeliveryRepository(prisma);
const at = (minute: number) => new Date(Date.UTC(2026, 8, 22, 10, minute));

async function addSubscription(suffix = randomUUID()) {
  return prisma.pushSubscription.create({
    data: {
      endpoint: `https://push.example.test/${suffix}`,
      p256dh: 'public-key',
      auth: 'auth-secret',
    },
  });
}

const newDelivery = (subscriptionId: string, scheduledFor = at(0), now = at(0)) =>
  ReminderDelivery.create({ noteId: randomUUID(), scheduledFor, subscriptionId }, now);

describe('PrismaReminderDeliveryRepository', () => {
  beforeEach(() => prisma.pushSubscription.deleteMany());
  afterAll(() => prisma.$disconnect());

  it('materializes each tuple once when ticks race or repeat', async () => {
    const subscription = await addSubscription();
    const first = newDelivery(subscription.id);
    const duplicate = ReminderDelivery.create(
      {
        noteId: first.noteId,
        scheduledFor: first.scheduledFor,
        subscriptionId: first.subscriptionId,
      },
      at(1),
    );

    await repository.materialize([first, duplicate]);
    await repository.materialize([duplicate]);

    expect(await prisma.reminderDelivery.count()).toBe(1);
  });

  it('lists only ready pending/retry deliveries, ordered and limited', async () => {
    const subscription = await addSubscription();
    const later = newDelivery(subscription.id, at(1), at(1));
    const first = newDelivery(subscription.id, at(0), at(0));
    const retry = newDelivery(subscription.id, at(2), at(0));
    retry.scheduleRetry(at(0), 503, at(0));
    const future = newDelivery(subscription.id, at(3), at(3));
    const sent = newDelivery(subscription.id, at(4), at(0));
    sent.recordSent(at(0));
    await repository.materialize([later, first, retry, future, sent]);
    await repository.save(retry);
    await repository.save(sent);

    expect((await repository.listReady(at(2), 2)).map(({ id }) => id)).toEqual([
      first.id,
      retry.id,
    ]);
    expect((await repository.listReady(at(2), 10)).map(({ id }) => id)).toEqual([
      first.id,
      retry.id,
      later.id,
    ]);
  });

  it('persists every terminal transition', async () => {
    const subscription = await addSubscription();
    const sent = newDelivery(subscription.id);
    const failed = newDelivery(subscription.id);
    const canceled = newDelivery(subscription.id);
    await repository.materialize([sent, failed, canceled]);

    sent.recordSent(at(1));
    failed.recordFailed(400, at(1));
    canceled.cancel(at(1));
    await Promise.all([repository.save(sent), repository.save(failed), repository.save(canceled)]);

    expect(await prisma.reminderDelivery.findMany({ orderBy: { status: 'asc' } })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: sent.id, status: 'sent', attempts: 1, sentAt: at(1) }),
        expect.objectContaining({
          id: failed.id,
          status: 'failed',
          attempts: 1,
          lastStatusCode: 400,
        }),
        expect.objectContaining({ id: canceled.id, status: 'canceled', attempts: 0 }),
      ]),
    );
  });

  it('cascades deliveries when their subscription is removed', async () => {
    const subscription = await addSubscription();
    await repository.materialize([newDelivery(subscription.id)]);

    await prisma.pushSubscription.delete({ where: { id: subscription.id } });

    expect(await prisma.reminderDelivery.count()).toBe(0);
  });
});
