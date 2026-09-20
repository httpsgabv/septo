import { beforeEach, describe, expect, it } from 'vitest';
import { UnauthenticatedError } from '../domain/errors.js';
import { User } from '../domain/user.js';
import { FakeTokenService, InMemoryUserRepository } from '../testing/fakes.js';
import { AuthenticateUseCase } from './authenticate.use-case.js';

const NOW = new Date('2026-09-20T10:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe('AuthenticateUseCase', () => {
  let users: InMemoryUserRepository;
  let tokens: FakeTokenService;
  let useCase: AuthenticateUseCase;
  let user: User;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    tokens = new FakeTokenService();
    useCase = new AuthenticateUseCase(tokens, users);
    useCase.now = () => NOW;
    user = User.create({ username: 'gabriel', passwordHash: 'hash' });
    await users.save(user);
  });

  it('identifies the user behind a valid token', async () => {
    const token = await tokens.issueAt({ userId: user.id, version: 0 }, daysAgo(1));

    expect(await useCase.execute(token)).toEqual({ userId: user.id, renewedToken: null });
  });

  it('rejects a missing token', async () => {
    await expect(useCase.execute(undefined)).rejects.toThrow(UnauthenticatedError);
    await expect(useCase.execute('')).rejects.toThrow(UnauthenticatedError);
  });

  it('rejects a token the service does not accept', async () => {
    await expect(useCase.execute('forged')).rejects.toThrow(UnauthenticatedError);
  });

  it('rejects a token of a user that no longer exists', async () => {
    const token = await tokens.issueAt({ userId: 'gone', version: 0 }, daysAgo(1));

    await expect(useCase.execute(token)).rejects.toThrow(UnauthenticatedError);
  });

  it('rejects a token from before the sessions were revoked', async () => {
    const token = await tokens.issueAt({ userId: user.id, version: 0 }, daysAgo(1));
    user.revokeSessions();
    await users.save(user);

    await expect(useCase.execute(token)).rejects.toThrow(UnauthenticatedError);
  });

  it('does not renew a token that is exactly 15 days old', async () => {
    const token = await tokens.issueAt({ userId: user.id, version: 0 }, daysAgo(15));

    expect((await useCase.execute(token)).renewedToken).toBeNull();
  });

  it('renews a token older than 15 days, carrying the current version', async () => {
    user.revokeSessions();
    await users.save(user);
    const token = await tokens.issueAt({ userId: user.id, version: 1 }, daysAgo(16));

    const { userId, renewedToken } = await useCase.execute(token);

    expect(userId).toBe(user.id);
    expect(renewedToken).not.toBeNull();
    expect(await tokens.verify(renewedToken as string)).toMatchObject({
      userId: user.id,
      version: 1,
    });
  });
});
