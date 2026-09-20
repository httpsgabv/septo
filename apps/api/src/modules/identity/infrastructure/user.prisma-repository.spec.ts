import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../../shared/env.js';
import { PrismaService } from '../../../shared/prisma.service.js';
import { User } from '../domain/user.js';
import { PrismaUserRepository } from './user.prisma-repository.js';

const prisma = new PrismaService(loadEnv());
const repository = new PrismaUserRepository(prisma);

describe('PrismaUserRepository', () => {
  beforeEach(() => prisma.user.deleteMany());
  afterAll(() => prisma.$disconnect());

  it('saves a new user and finds it by id and by username', async () => {
    const user = User.create({ username: 'gabriel', passwordHash: 'hash-1' });

    await repository.save(user);

    for (const found of [
      await repository.findById(user.id),
      await repository.findByUsername('gabriel'),
    ]) {
      expect(found).toBeInstanceOf(User);
      expect(found?.id).toBe(user.id);
      expect(found?.displayName).toBe('gabriel');
      expect(found?.passwordHash).toBe('hash-1');
      expect(found?.tokenVersion).toBe(0);
      expect(found?.lastLoginAt).toBeNull();
      expect(found?.lastLoginIp).toBeNull();
    }
  });

  it('returns null when nothing matches', async () => {
    expect(await repository.findById('7f1c2b3a-0000-4000-8000-000000000000')).toBeNull();
    expect(await repository.findByUsername('nobody')).toBeNull();
    expect(await repository.findFirst()).toBeNull();
  });

  it('persists changes made to an existing user', async () => {
    const user = User.create({ username: 'gabriel', passwordHash: 'hash-1' });
    await repository.save(user);
    const at = new Date('2026-09-20T10:00:00.000Z');

    user.changePassword('hash-2');
    user.updateProfile({ displayName: 'Gabriel B.' });
    user.recordLogin('203.0.113.7', at);
    await repository.save(user);

    const found = await repository.findById(user.id);
    expect(found?.passwordHash).toBe('hash-2');
    expect(found?.displayName).toBe('Gabriel B.');
    expect(found?.tokenVersion).toBe(1);
    expect(found?.lastLoginAt).toEqual(at);
    expect(found?.lastLoginIp).toBe('203.0.113.7');
    expect(await prisma.user.count()).toBe(1);
  });

  it('finds the single user', async () => {
    const user = User.create({ username: 'gabriel', passwordHash: 'hash-1' });
    await repository.save(user);

    expect((await repository.findFirst())?.id).toBe(user.id);
  });

  it('saving the last login never overwrites a password or version changed in the meantime', async () => {
    const user = User.create({ username: 'gabriel', passwordHash: 'hash-1' });
    await repository.save(user);
    const staleCopy = await repository.findById(user.id); // what a login read before the reset
    const reset = await repository.findById(user.id);
    reset?.changePassword('hash-2');
    await repository.save(reset as User);
    const at = new Date('2026-09-20T10:00:00.000Z');

    (staleCopy as User).recordLogin('203.0.113.7', at);
    await repository.saveLastLogin(staleCopy as User);

    const found = await repository.findById(user.id);
    expect(found?.passwordHash).toBe('hash-2');
    expect(found?.tokenVersion).toBe(1);
    expect(found?.lastLoginAt).toEqual(at);
    expect(found?.lastLoginIp).toBe('203.0.113.7');
  });
});
