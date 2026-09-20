import { beforeEach, describe, expect, it } from 'vitest';
import {
  InvalidCurrentPasswordError,
  UnauthenticatedError,
  WeakPasswordError,
} from '../domain/errors.js';
import { User } from '../domain/user.js';
import { FakePasswordHasher, FakeTokenService, InMemoryUserRepository } from '../testing/fakes.js';
import { ChangePasswordUseCase } from './change-password.use-case.js';

const CURRENT = 'current-password-1';
const NEXT = 'brand-new-password-2';

describe('ChangePasswordUseCase', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let tokens: FakeTokenService;
  let useCase: ChangePasswordUseCase;
  let user: User;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    tokens = new FakeTokenService();
    useCase = new ChangePasswordUseCase(users, hasher, tokens);
    user = User.create({ username: 'gabriel', passwordHash: await hasher.hash(CURRENT) });
    await users.save(user);
  });

  it('stores the new hash and drops every other session', async () => {
    await useCase.execute({ userId: user.id, currentPassword: CURRENT, newPassword: NEXT });

    const stored = await users.findById(user.id);
    expect(stored?.passwordHash).toBe(await hasher.hash(NEXT));
    expect(stored?.tokenVersion).toBe(1);
  });

  it('hands back a token for the new version, so this session survives', async () => {
    const { token } = await useCase.execute({
      userId: user.id,
      currentPassword: CURRENT,
      newPassword: NEXT,
    });

    expect(await tokens.verify(token)).toMatchObject({ userId: user.id, version: 1 });
  });

  it('refuses a wrong current password and changes nothing', async () => {
    const savesBefore = users.saves;

    await expect(
      useCase.execute({
        userId: user.id,
        currentPassword: 'not-the-password-9',
        newPassword: NEXT,
      }),
    ).rejects.toThrow(InvalidCurrentPasswordError);

    expect(users.saves).toBe(savesBefore);
    expect(user.tokenVersion).toBe(0);
    expect(user.passwordHash).toBe(await hasher.hash(CURRENT));
  });

  it('refuses a weak new password before doing any hashing work', async () => {
    await expect(
      useCase.execute({ userId: user.id, currentPassword: CURRENT, newPassword: 'short' }),
    ).rejects.toThrow(WeakPasswordError);

    expect(hasher.verified).toEqual([]);
    expect(user.tokenVersion).toBe(0);
  });

  it('treats a missing user as an expired session', async () => {
    await expect(
      useCase.execute({ userId: 'gone', currentPassword: CURRENT, newPassword: NEXT }),
    ).rejects.toThrow(UnauthenticatedError);
  });
});
