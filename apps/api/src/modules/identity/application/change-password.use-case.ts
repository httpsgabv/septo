import { Injectable } from '@nestjs/common';
import { InvalidCurrentPasswordError, UnauthenticatedError } from '../domain/errors.js';
import { PasswordHasher } from '../domain/password-hasher.js';
import { validatePassword } from '../domain/password-policy.js';
import { TokenService } from '../domain/token-service.js';
import { UserRepository } from '../domain/user.repository.js';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  /** Returns a token for the new `tokenVersion`, so the caller's own session survives the change. */
  async execute(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<{ token: string }> {
    validatePassword(input.newPassword);
    const user = await this.users.findById(input.userId);
    if (!user) throw new UnauthenticatedError();
    if (!(await this.hasher.verify(input.currentPassword, user.passwordHash))) {
      throw new InvalidCurrentPasswordError();
    }

    user.changePassword(await this.hasher.hash(input.newPassword));
    await this.users.save(user);
    return { token: await this.tokens.issue({ userId: user.id, version: user.tokenVersion }) };
  }
}
