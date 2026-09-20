import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticateUseCase } from './application/authenticate.use-case.js';
import { ChangePasswordUseCase } from './application/change-password.use-case.js';
import { GetMeUseCase } from './application/get-me.use-case.js';
import { LoginUseCase } from './application/login.use-case.js';
import { SetUserUseCase } from './application/set-user.use-case.js';
import { UpdateProfileUseCase } from './application/update-profile.use-case.js';
import { LoginAttempts } from './domain/login-attempts.js';
import { PasswordHasher } from './domain/password-hasher.js';
import { TokenService } from './domain/token-service.js';
import { UserRepository } from './domain/user.repository.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import { InMemoryLoginAttempts } from './infrastructure/in-memory-login-attempts.js';
import { JoseTokenService } from './infrastructure/jose-token-service.js';
import { PrismaUserRepository } from './infrastructure/user.prisma-repository.js';
import { AuthController } from './presentation/auth.controller.js';
import { AuthGuard } from './presentation/auth.guard.js';
import { MeController } from './presentation/me.controller.js';

@Module({
  controllers: [AuthController, MeController],
  providers: [
    SetUserUseCase,
    AuthenticateUseCase,
    GetMeUseCase,
    LoginUseCase,
    UpdateProfileUseCase,
    ChangePasswordUseCase,
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: TokenService, useClass: JoseTokenService },
    { provide: LoginAttempts, useClass: InMemoryLoginAttempts },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SetUserUseCase],
})
export class IdentityModule {}
