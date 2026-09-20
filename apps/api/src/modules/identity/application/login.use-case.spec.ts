import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidCredentialsError, TooManyAttemptsError } from '../domain/errors.js';
import { User } from '../domain/user.js';
import { InMemoryLoginAttempts } from '../infrastructure/in-memory-login-attempts.js';
import { FakePasswordHasher, FakeTokenService, InMemoryUserRepository } from '../testing/fakes.js';
import { LoginUseCase, TIMING_DECOY_HASH } from './login.use-case.js';

const NOW = new Date('2026-09-20T10:00:00.000Z');
const PASSWORD = 'a-long-password-1';
const IP = '203.0.113.7';

describe('LoginUseCase', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let tokens: FakeTokenService;
  let attempts: InMemoryLoginAttempts;
  let useCase: LoginUseCase;
  let user: User;

  const login = (password: string, username = 'gabriel', ip = IP) =>
    useCase.execute({ username, password, ip });
  const failTimes = async (times: number) => {
    for (let i = 0; i < times; i++) await login('wrong-password-000').catch(() => {});
  };

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    tokens = new FakeTokenService();
    attempts = new InMemoryLoginAttempts();
    useCase = new LoginUseCase(users, hasher, tokens, attempts);
    useCase.now = () => NOW;
    user = User.create({ username: 'gabriel', passwordHash: await hasher.hash(PASSWORD) });
    await users.save(user);
    hasher.verified.length = 0;
  });

  it('signs in with the right credentials and records where from', async () => {
    const result = await login(PASSWORD);

    expect(result.user).toBe(user);
    expect(await tokens.verify(result.token)).toMatchObject({ userId: user.id, version: 0 });
    expect(user.lastLoginAt).toEqual(NOW);
    expect(user.lastLoginIp).toBe(IP);
    expect((await users.findById(user.id))?.lastLoginIp).toBe(IP);
  });

  it('only writes the last login, never the whole user', async () => {
    const fullSavesBefore = users.fullSaves;

    await login(PASSWORD);

    expect(users.fullSaves).toBe(fullSavesBefore);
    expect(users.lastLoginSaves).toBe(1);
  });

  it('rejects a wrong password', async () => {
    await expect(login('wrong-password-000')).rejects.toThrow(InvalidCredentialsError);
    expect(user.lastLoginAt).toBeNull();
  });

  it('rejects an unknown username with the very same error', async () => {
    const wrongPassword = await login('wrong-password-000').catch((e) => e);
    const unknownUser = await login(PASSWORD, 'nobody').catch((e) => e);

    expect(unknownUser).toBeInstanceOf(InvalidCredentialsError);
    expect(unknownUser.message).toBe(wrongPassword.message);
    expect(unknownUser.code).toBe(wrongPassword.code);
  });

  it('still runs a password verification for an unknown username', async () => {
    await login(PASSWORD, 'nobody').catch(() => {});

    expect(hasher.verified).toEqual([TIMING_DECOY_HASH]);
  });

  it('blocks the IP after 5 failures, even with the right password, without hashing', async () => {
    await failTimes(5);
    hasher.verified.length = 0;

    const error = await login(PASSWORD).catch((e) => e);

    expect(error).toBeInstanceOf(TooManyAttemptsError);
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(hasher.verified).toEqual([]);
  });

  it('counts the attempt before the slow verification, so parallel guesses cannot exceed the limit', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => login('wrong-password-000')),
    );

    const blocked = results.filter(
      (r) => r.status === 'rejected' && r.reason instanceof TooManyAttemptsError,
    );
    expect(hasher.verified).toHaveLength(5);
    expect(blocked).toHaveLength(5);
  });

  it('counts failures per IP', async () => {
    await failTimes(5);

    await expect(login(PASSWORD, 'gabriel', '198.51.100.1')).resolves.toBeDefined();
  });

  it('a successful login clears the failures', async () => {
    await failTimes(4);
    await login(PASSWORD);
    await failTimes(4);

    await expect(login(PASSWORD)).resolves.toBeDefined();
  });
});
