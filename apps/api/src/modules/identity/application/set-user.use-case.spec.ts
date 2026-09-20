import { describe, expect, it } from 'vitest';
import { InvalidUsernameError, WeakPasswordError } from '../domain/errors.js';
import { FakePasswordHasher, InMemoryUserRepository } from '../testing/fakes.js';
import { SetUserUseCase } from './set-user.use-case.js';

const setup = () => {
  const users = new InMemoryUserRepository();
  return { users, useCase: new SetUserUseCase(users, new FakePasswordHasher()) };
};

describe('SetUserUseCase', () => {
  it('creates the user when none exists', async () => {
    const { users, useCase } = setup();

    const result = await useCase.execute({ username: 'gabriel', password: 'a-long-password-1' });

    expect(result).toEqual({ created: true });
    const [user] = [...users.users.values()];
    expect(user?.username).toBe('gabriel');
    expect(user?.displayName).toBe('gabriel');
    expect(user?.passwordHash).toBe('hashed:a-long-password-1');
    expect(user?.tokenVersion).toBe(0);
  });

  it('resets the only user instead of creating another one', async () => {
    const { users, useCase } = setup();
    await useCase.execute({ username: 'gabriel', password: 'a-long-password-1' });
    const [before] = [...users.users.values()];
    before?.updateProfile({ displayName: 'Gabriel B.' });

    const result = await useCase.execute({ username: 'gabriel.b', password: 'another-password-2' });

    expect(result).toEqual({ created: false });
    expect(users.users.size).toBe(1);
    const [after] = [...users.users.values()];
    expect(after?.id).toBe(before?.id);
    expect(after?.username).toBe('gabriel.b');
    expect(after?.displayName).toBe('Gabriel B.');
    expect(after?.passwordHash).toBe('hashed:another-password-2');
    expect(after?.tokenVersion).toBe(1);
  });

  it('rejects a weak password without touching the repository', async () => {
    const { users, useCase } = setup();

    await expect(useCase.execute({ username: 'gabriel', password: 'short' })).rejects.toThrow(
      WeakPasswordError,
    );
    expect(users.saves).toBe(0);
  });

  it('rejects an invalid username without touching the repository', async () => {
    const { users, useCase } = setup();

    await expect(
      useCase.execute({ username: 'not valid', password: 'a-long-password-1' }),
    ).rejects.toThrow(InvalidUsernameError);
    expect(users.saves).toBe(0);
  });
});
