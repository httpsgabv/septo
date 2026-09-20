import { Module } from '@nestjs/common';
import { PasswordHasher } from './domain/password-hasher.js';
import { UserRepository } from './domain/user.repository.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import { PrismaUserRepository } from './infrastructure/user.prisma-repository.js';

@Module({
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
  ],
})
export class IdentityModule {}
