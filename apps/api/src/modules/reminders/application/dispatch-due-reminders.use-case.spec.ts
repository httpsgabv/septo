import { beforeEach, describe, expect, it } from 'vitest';
import type { ReminderCandidate } from '../../notes/domain/reminder-source.js';
import { PushSubscription } from '../domain/push-subscription.js';
import {
  FakePushSender,
  InMemoryPushSubscriptionRepository,
  InMemoryReminderDeliveryRepository,
  InMemoryReminderSource,
} from '../testing/fakes.js';
import {
  DISPATCH_BATCH_SIZE,
  DispatchDueRemindersUseCase,
  RECOVERY_WINDOW_MS,
} from './dispatch-due-reminders.use-case.js';

const minute = 60_000;
const now = new Date('2026-09-22T12:00:00.000Z');
const noteId = '7f1c2b3a-0000-4000-8000-000000000001';
const candidate = (patch: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  id: noteId,
  title: 'Comprar café',
  remindAt: new Date(now.getTime() - minute),
  updatedAt: new Date(now.getTime() - 2 * minute),
  ...patch,
});
const subscription = (endpoint: string, createdAt: Date) =>
  PushSubscription.restore({
    id: crypto.randomUUID(),
    endpoint,
    p256dh: 'public-key',
    auth: 'auth-secret',
    expirationTime: null,
    createdAt,
    updatedAt: createdAt,
  });

describe('DispatchDueRemindersUseCase', () => {
  let source: InMemoryReminderSource;
  let subscriptions: InMemoryPushSubscriptionRepository;
  let deliveries: InMemoryReminderDeliveryRepository;
  let sender: FakePushSender;
  let useCase: DispatchDueRemindersUseCase;

  beforeEach(() => {
    const events: string[] = [];
    source = new InMemoryReminderSource(events);
    subscriptions = new InMemoryPushSubscriptionRepository(events);
    deliveries = new InMemoryReminderDeliveryRepository(events);
    subscriptions.onDelete = (id) => deliveries.deleteBySubscription(id);
    sender = new FakePushSender(events);
    useCase = new DispatchDueRemindersUseCase(source, subscriptions, deliveries, sender);
  });

  it('fans out to eligible devices once and uses the recovery window and batch limit', async () => {
    source.add(candidate());
    await subscriptions.upsert(
      subscription('https://push.example.test/a', new Date(now.getTime() - 3 * minute)),
    );
    await subscriptions.upsert(
      subscription('https://push.example.test/b', new Date(now.getTime() - 2 * minute)),
    );
    await subscriptions.upsert(subscription('https://push.example.test/too-new', now));

    const first = await useCase.execute(now);
    const second = await useCase.execute(now);

    expect(source.lastListInput).toEqual({
      after: new Date(now.getTime() - RECOVERY_WINDOW_MS),
      through: now,
      limit: DISPATCH_BATCH_SIZE,
    });
    expect(deliveries.items).toHaveLength(2);
    expect(sender.calls).toHaveLength(2);
    expect(sender.calls[0]?.payload).toMatchObject({
      title: 'Lembrete',
      body: 'Comprar café',
      url: `/notes/${noteId}`,
      tag: `reminder:${noteId}`,
    });
    const firstSend = deliveries.events.indexOf('sender.send');
    expect(firstSend).toBeGreaterThan(deliveries.events.indexOf('deliveries.materialize'));
    expect(firstSend).toBeGreaterThan(deliveries.events.indexOf('deliveries.listReady'));
    expect(firstSend).toBeGreaterThan(deliveries.events.indexOf('source.findCurrent'));
    expect(firstSend).toBeGreaterThan(deliveries.events.indexOf('subscriptions.findById'));
    expect(deliveries.items.every(({ status }) => status === 'sent')).toBe(true);
    expect(first).toMatchObject({ candidates: 1, ready: 2, sent: 2 });
    expect(second).toMatchObject({ candidates: 1, ready: 0, sent: 0 });
  });

  it('finishes all reads before sending and cancels a reminder that is no longer current', async () => {
    const events = deliveries.events;
    source.add(candidate());
    source.current.clear();
    await subscriptions.upsert(
      subscription('https://push.example.test/a', new Date(now.getTime() - 3 * minute)),
    );
    events.length = 0;

    const summary = await useCase.execute(now);

    expect(events).toEqual([
      'source.listDue',
      'subscriptions.listActiveAt',
      'deliveries.materialize',
      'deliveries.listReady',
      'source.findCurrent',
      'deliveries.save',
    ]);
    expect(sender.calls).toHaveLength(0);
    expect(deliveries.items[0]?.status).toBe('canceled');
    expect(summary.canceled).toBe(1);
  });

  it('persists sent, retry and permanent failure, and removes gone subscriptions', async () => {
    source.add(candidate());
    const endpoints = ['sent', 'gone', 'retry', 'failed'].map(
      (name) => `https://push.example.test/${name}`,
    );
    for (const endpoint of endpoints) {
      await subscriptions.upsert(subscription(endpoint, new Date(now.getTime() - 3 * minute)));
    }
    sender.results.push(
      { kind: 'sent' },
      { kind: 'gone', statusCode: 410 },
      { kind: 'transient', statusCode: 503 },
      { kind: 'permanent', statusCode: 400 },
    );

    const summary = await useCase.execute(now);

    expect(summary).toMatchObject({ sent: 1, retried: 1, failed: 1, subscriptionsRemoved: 1 });
    expect(subscriptions.items.some(({ endpoint }) => endpoint === endpoints[1])).toBe(false);
    expect(deliveries.items.map(({ status }) => status).sort()).toEqual(
      ['failed', 'retry', 'sent'].sort(),
    );
    expect(deliveries.items.find(({ status }) => status === 'retry')).toMatchObject({
      attempts: 1,
      nextAttemptAt: new Date(now.getTime() + minute),
      lastStatusCode: 503,
    });
  });

  it('makes at most three transient attempts at immediate, +1 minute and +5 minutes', async () => {
    source.add(candidate());
    await subscriptions.upsert(
      subscription('https://push.example.test/a', new Date(now.getTime() - 3 * minute)),
    );
    sender.results.push(
      { kind: 'transient' },
      { kind: 'transient', statusCode: 429 },
      { kind: 'transient', statusCode: 500 },
    );

    await useCase.execute(now);
    expect(deliveries.items[0]).toMatchObject({
      status: 'retry',
      attempts: 1,
      nextAttemptAt: new Date(now.getTime() + minute),
    });
    await useCase.execute(new Date(now.getTime() + minute - 1));
    expect(sender.calls).toHaveLength(1);

    const secondAt = new Date(now.getTime() + minute);
    await useCase.execute(secondAt);
    expect(deliveries.items[0]).toMatchObject({
      status: 'retry',
      attempts: 2,
      nextAttemptAt: new Date(secondAt.getTime() + 5 * minute),
    });

    await useCase.execute(new Date(secondAt.getTime() + 5 * minute));
    expect(sender.calls).toHaveLength(3);
    expect(deliveries.items[0]).toMatchObject({
      status: 'failed',
      attempts: 3,
      lastStatusCode: 500,
    });
  });

  it('does not materialize reminders outside 24 hours or created after they were due', async () => {
    source.add(
      candidate({
        id: crypto.randomUUID(),
        remindAt: new Date(now.getTime() - RECOVERY_WINDOW_MS),
        updatedAt: new Date(now.getTime() - RECOVERY_WINDOW_MS - minute),
      }),
    );
    source.add(candidate({ id: crypto.randomUUID(), updatedAt: now }));
    await subscriptions.upsert(
      subscription('https://push.example.test/a', new Date(now.getTime() - 3 * minute)),
    );

    await useCase.execute(now);

    expect(deliveries.items).toHaveLength(0);
    expect(sender.calls).toHaveLength(0);
  });
});
