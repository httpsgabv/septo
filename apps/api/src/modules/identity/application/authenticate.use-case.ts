import { Injectable } from '@nestjs/common';
import { UnauthenticatedError } from '../domain/errors.js';
import { SESSION_RENEW_AFTER_SECONDS } from '../domain/session.js';
import { TokenService } from '../domain/token-service.js';
import { UserRepository } from '../domain/user.repository.js';

/** Turns a session token into a user id, or throws. The user is read on every request (revocation). */
@Injectable()
export class AuthenticateUseCase {
  /** Replaced in tests to move through time. */
  now = () => new Date();

  constructor(
    private readonly tokens: TokenService,
    private readonly users: UserRepository,
  ) {}

  async execute(
    token: string | undefined,
  ): Promise<{ userId: string; renewedToken: string | null }> {
    const claims = token ? await this.tokens.verify(token) : null;
    if (!claims) throw new UnauthenticatedError();

    const user = await this.users.findById(claims.userId);
    // The same error for every cause: a client must not learn why it was rejected.
    if (!user || user.tokenVersion !== claims.version) throw new UnauthenticatedError();

    const ageSeconds = (this.now().getTime() - claims.issuedAt.getTime()) / 1000;
    const renewedToken =
      ageSeconds > SESSION_RENEW_AFTER_SECONDS
        ? await this.tokens.issue({ userId: user.id, version: user.tokenVersion })
        : null;
    return { userId: user.id, renewedToken };
  }
}
