import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../src/app.js';
import { AppModule } from '../src/app.module.js';
import { PasswordHasher } from '../src/modules/identity/domain/password-hasher.js';
import { TokenService } from '../src/modules/identity/domain/token-service.js';
import { User } from '../src/modules/identity/domain/user.js';
import { UserRepository } from '../src/modules/identity/domain/user.repository.js';
import { PrismaService } from '../src/shared/prisma.service.js';

export const PASSWORD = 'a-long-password-1';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication({ logger: false }));
  await app.init();
  return app;
}

/** Replaces every user with a fresh `gabriel`, and hands out session cookies for it. */
export async function resetUser(app: INestApplication) {
  await app.get(PrismaService).user.deleteMany();
  const user = User.create({
    username: 'gabriel',
    passwordHash: await app.get(PasswordHasher).hash(PASSWORD),
  });
  await app.get(UserRepository).save(user);

  /** A cookie for a new "device": valid until the user's `tokenVersion` changes. */
  const newSession = async () => {
    const token = await app.get(TokenService).issue({
      userId: user.id,
      version: (await app.get(UserRepository).findById(user.id))?.tokenVersion ?? 0,
    });
    return `septo_session=${token}`;
  };
  return { user, newSession };
}
