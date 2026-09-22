import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../../shared/env.js';
import { PrismaService } from '../../../shared/prisma.service.js';
import { PushSubscription } from '../domain/push-subscription.js';
import { PrismaPushSubscriptionRepository } from './push-subscription.prisma-repository.js';

const prisma = new PrismaService(loadEnv());
const repository = new PrismaPushSubscriptionRepository(prisma);
const at = (day: number) => new Date(Date.UTC(2026, 8, day, 10));
const input = {
  endpoint: 'https://push.example.test/subscriptions/secret',
  p256dh: 'public-key_1',
  auth: 'auth-secret_1',
  expirationTime: at(30),
};

describe('PrismaPushSubscriptionRepository', () => {
  beforeEach(() => prisma.pushSubscription.deleteMany());
  afterAll(() => prisma.$disconnect());

  it('upserts by endpoint while preserving id and createdAt', async () => {
    const created = await repository.upsert(PushSubscription.create(input, at(20)));
    const refreshed = await repository.upsert(
      PushSubscription.create(
        { ...input, p256dh: 'new-public-key', auth: 'new-auth', expirationTime: null },
        at(21),
      ),
    );

    expect(refreshed).toMatchObject({
      id: created.id,
      endpoint: input.endpoint,
      p256dh: 'new-public-key',
      auth: 'new-auth',
      expirationTime: null,
      createdAt: created.createdAt,
    });
    expect(await prisma.pushSubscription.count()).toBe(1);
    await expect(repository.findById(created.id)).resolves.toMatchObject({ id: created.id });
  });

  it('lists only subscriptions that are unexpired at the supplied instant', async () => {
    const neverExpires = await repository.upsert(
      PushSubscription.create(
        { ...input, endpoint: `${input.endpoint}/never`, expirationTime: null },
        at(20),
      ),
    );
    const future = await repository.upsert(
      PushSubscription.create(
        { ...input, endpoint: `${input.endpoint}/future`, expirationTime: at(23) },
        at(20),
      ),
    );
    await repository.upsert(
      PushSubscription.create(
        { ...input, endpoint: `${input.endpoint}/exact`, expirationTime: at(22) },
        at(20),
      ),
    );
    await repository.upsert(
      PushSubscription.create(
        { ...input, endpoint: `${input.endpoint}/past`, expirationTime: at(21) },
        at(20),
      ),
    );

    expect((await repository.listActiveAt(at(22))).map(({ id }) => id).sort()).toEqual(
      [neverExpires.id, future.id].sort(),
    );
  });

  it('deletes idempotently and treats malformed ids as absent', async () => {
    const subscription = await repository.upsert(PushSubscription.create(input, at(20)));

    await expect(repository.delete(subscription.id)).resolves.toBeUndefined();
    await expect(repository.delete(subscription.id)).resolves.toBeUndefined();
    await expect(repository.delete('not-a-uuid')).resolves.toBeUndefined();
    await expect(repository.findById(subscription.id)).resolves.toBeNull();
    await expect(repository.findById('not-a-uuid')).resolves.toBeNull();
  });
});
