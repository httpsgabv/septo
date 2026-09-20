import { describe, expect, it } from 'vitest';
import { InvalidDisplayNameError, UnauthenticatedError } from '../domain/errors.js';
import { User } from '../domain/user.js';
import { InMemoryUserRepository } from '../testing/fakes.js';
import { UpdateProfileUseCase } from './update-profile.use-case.js';

const setup = async () => {
  const users = new InMemoryUserRepository();
  const user = User.create({ username: 'gabriel', passwordHash: 'hash' });
  await users.save(user);
  return { users, user, useCase: new UpdateProfileUseCase(users) };
};

describe('UpdateProfileUseCase', () => {
  it('changes and persists the display name', async () => {
    const { users, user, useCase } = await setup();

    const updated = await useCase.execute({ userId: user.id, displayName: 'Gabriel B.' });

    expect(updated.displayName).toBe('Gabriel B.');
    expect((await users.findById(user.id))?.displayName).toBe('Gabriel B.');
  });

  it('keeps the username and the sessions untouched', async () => {
    const { user, useCase } = await setup();

    await useCase.execute({ userId: user.id, displayName: 'Gabriel B.' });

    expect(user.username).toBe('gabriel');
    expect(user.tokenVersion).toBe(0);
  });

  it('rejects an invalid name without saving', async () => {
    const { users, user, useCase } = await setup();
    const savesBefore = users.saves;

    await expect(useCase.execute({ userId: user.id, displayName: ' padded ' })).rejects.toThrow(
      InvalidDisplayNameError,
    );
    expect(users.saves).toBe(savesBefore);
  });

  it('treats a missing user as an expired session', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ userId: 'gone', displayName: 'X' })).rejects.toThrow(
      UnauthenticatedError,
    );
  });
});
