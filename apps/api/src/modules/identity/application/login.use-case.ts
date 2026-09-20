import { Injectable } from '@nestjs/common';
import { InvalidCredentialsError, TooManyAttemptsError } from '../domain/errors.js';
import { LoginAttempts } from '../domain/login-attempts.js';
import { PasswordHasher } from '../domain/password-hasher.js';
import { TokenService } from '../domain/token-service.js';
import type { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';

/**
 * Verified when the username does not exist, so an unknown user costs the same argon2 work as a
 * wrong password. Must be generated with the production parameters (a test checks they match).
 */
export const TIMING_DECOY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$RVHW8JZjI4jaHr+fZHLS9w$jdwqwims/yACYnQJsjxsrQgGcbd1VSmJ7GRUjvbhitk';

@Injectable()
export class LoginUseCase {
  /** Replaced in tests to move through time. */
  now = () => new Date();

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly attempts: LoginAttempts,
  ) {}

  async execute(input: {
    username: string;
    password: string;
    ip: string;
  }): Promise<{ user: User; token: string }> {
    const retryAfterSeconds = this.attempts.retryAfterSeconds(input.ip);
    if (retryAfterSeconds > 0) throw new TooManyAttemptsError(retryAfterSeconds);

    // Counted up front, in the same tick as the check above: N parallel guesses can then run at most
    // `limit` verifications. A correct password resets the counter below.
    this.attempts.recordAttempt(input.ip);

    const user = await this.users.findByUsername(input.username);
    const passwordMatches = await this.hasher.verify(
      input.password,
      user?.passwordHash ?? TIMING_DECOY_HASH,
    );
    if (!user || !passwordMatches) throw new InvalidCredentialsError();

    this.attempts.reset(input.ip);
    user.recordLogin(input.ip, this.now());
    await this.users.saveLastLogin(user);
    const token = await this.tokens.issue({ userId: user.id, version: user.tokenVersion });
    return { user, token };
  }
}
