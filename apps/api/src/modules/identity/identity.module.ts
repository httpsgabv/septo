import { Module } from '@nestjs/common';
import { SetUserUseCase } from './application/set-user.use-case.js';
import { PasswordHasher } from './domain/password-hasher.js';
import { UserRepository } from './domain/user.repository.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import { PrismaUserRepository } from './infrastructure/user.prisma-repository.js';

@Module({
  providers: [
    SetUserUseCase,
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
  ],
  exports: [SetUserUseCase],
})
export class IdentityModule {}
