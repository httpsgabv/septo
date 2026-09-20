import { describe, expect, it } from 'vitest';
import { UnauthenticatedError } from '../domain/errors.js';
import { User } from '../domain/user.js';
import { InMemoryUserRepository } from '../testing/fakes.js';
import { RevokeSessionsUseCase } from './revoke-sessions.use-case.js';

describe('RevokeSessionsUseCase', () => {
  it('bumps the token version and persists it', async () => {
    const users = new InMemoryUserRepository();
    const user = User.create({ username: 'gabriel', passwordHash: 'hash' });
    await users.save(user);

    await new RevokeSessionsUseCase(users).execute(user.id);

    const stored = await users.findById(user.id);
    expect(stored?.tokenVersion).toBe(1);
    expect(stored?.passwordHash).toBe('hash');
  });

  it('treats a missing user as an expired session', async () => {
    await expect(
      new RevokeSessionsUseCase(new InMemoryUserRepository()).execute('gone'),
    ).rejects.toThrow(UnauthenticatedError);
  });
});
