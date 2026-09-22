import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../../shared/env.js';
import { InvalidPushSubscriptionError } from '../domain/push-subscription.js';
import { InMemoryPushSubscriptionRepository } from '../testing/fakes.js';
import { DeletePushSubscriptionUseCase } from './delete-push-subscription.use-case.js';
import { GetPushConfigUseCase } from './get-push-config.use-case.js';
import { UpsertPushSubscriptionUseCase } from './upsert-push-subscription.use-case.js';

const now = new Date('2026-09-22T12:00:00.000Z');
const input = {
  endpoint: 'https://push.example.test/subscriptions/secret',
  expirationTime: Date.parse('2026-10-22T12:00:00.000Z'),
  keys: { p256dh: 'public-key', auth: 'auth-secret' },
};

describe('push subscription use cases', () => {
  it('returns only the public VAPID key', () => {
    const env = parseEnv({});

    expect(new GetPushConfigUseCase(env).execute()).toEqual({ publicKey: env.VAPID_PUBLIC_KEY });
  });

  it('converts expiration epoch, upserts by endpoint, and returns only a stable id', async () => {
    const repository = new InMemoryPushSubscriptionRepository();
    const useCase = new UpsertPushSubscriptionUseCase(repository);
    useCase.now = () => now;

    const first = await useCase.execute(input);
    const second = await useCase.execute({
      ...input,
      expirationTime: null,
      keys: { p256dh: 'new-public-key', auth: 'new-auth' },
    });

    expect(second).toEqual(first);
    expect(repository.items).toHaveLength(1);
    expect(repository.items[0]).toMatchObject({
      id: first.id,
      expirationTime: null,
      p256dh: 'new-public-key',
      auth: 'new-auth',
      createdAt: now,
    });
    expect(Object.keys(first)).toEqual(['id']);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'turns invalid expiration epoch %s into a domain validation error',
    async (expirationTime) => {
      const useCase = new UpsertPushSubscriptionUseCase(new InMemoryPushSubscriptionRepository());

      await expect(useCase.execute({ ...input, expirationTime })).rejects.toBeInstanceOf(
        InvalidPushSubscriptionError,
      );
    },
  );

  it('deletes existing and absent subscriptions idempotently', async () => {
    const repository = new InMemoryPushSubscriptionRepository();
    const upsert = new UpsertPushSubscriptionUseCase(repository);
    upsert.now = () => now;
    const { id } = await upsert.execute(input);
    const remove = new DeletePushSubscriptionUseCase(repository);

    await remove.execute(id);
    await remove.execute(id);
    await remove.execute('7f1c2b3a-0000-4000-8000-000000000000');

    expect(repository.items).toHaveLength(0);
  });
});
