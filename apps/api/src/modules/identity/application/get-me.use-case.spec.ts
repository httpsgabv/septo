import { describe, expect, it } from 'vitest';
import { UnauthenticatedError } from '../domain/errors.js';
import { User } from '../domain/user.js';
import { InMemoryUserRepository } from '../testing/fakes.js';
import { GetMeUseCase } from './get-me.use-case.js';

describe('GetMeUseCase', () => {
  it('returns the user', async () => {
    const users = new InMemoryUserRepository();
    const user = User.create({ username: 'gabriel', passwordHash: 'hash' });
    await users.save(user);

    expect(await new GetMeUseCase(users).execute(user.id)).toBe(user);
  });

  it('treats a missing user as an expired session', async () => {
    await expect(new GetMeUseCase(new InMemoryUserRepository()).execute('gone')).rejects.toThrow(
      UnauthenticatedError,
    );
  });
});
