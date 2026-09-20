import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../domain/password-hasher.js';
import { validatePassword } from '../domain/password-policy.js';
import { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';
import { validateUsername } from '../domain/username.js';

/** septo has a single user: creates it, or resets username and password (dropping every session). */
@Injectable()
export class SetUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: { username: string; password: string }): Promise<{ created: boolean }> {
    validateUsername(input.username);
    validatePassword(input.password);
    const passwordHash = await this.hasher.hash(input.password);

    const existing = await this.users.findFirst();
    if (!existing) {
      await this.users.save(User.create({ username: input.username, passwordHash }));
      return { created: true };
    }
    existing.rename(input.username);
    existing.changePassword(passwordHash);
    await this.users.save(existing);
    return { created: false };
  }
}
