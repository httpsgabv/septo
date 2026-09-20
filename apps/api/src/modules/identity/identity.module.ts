import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticateUseCase } from './application/authenticate.use-case.js';
import { GetMeUseCase } from './application/get-me.use-case.js';
import { SetUserUseCase } from './application/set-user.use-case.js';
import { PasswordHasher } from './domain/password-hasher.js';
import { TokenService } from './domain/token-service.js';
import { UserRepository } from './domain/user.repository.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import { JoseTokenService } from './infrastructure/jose-token-service.js';
import { PrismaUserRepository } from './infrastructure/user.prisma-repository.js';
import { AuthGuard } from './presentation/auth.guard.js';
import { MeController } from './presentation/me.controller.js';

@Module({
  controllers: [MeController],
  providers: [
    SetUserUseCase,
    AuthenticateUseCase,
    GetMeUseCase,
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: TokenService, useClass: JoseTokenService },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SetUserUseCase],
})
export class IdentityModule {}
