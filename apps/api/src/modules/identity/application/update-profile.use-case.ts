import { Injectable } from '@nestjs/common';
import { UnauthenticatedError } from '../domain/errors.js';
import type { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';

@Injectable()
export class UpdateProfileUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: { userId: string; displayName: string }): Promise<User> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new UnauthenticatedError();
    user.updateProfile({ displayName: input.displayName });
    await this.users.save(user);
    return user;
  }
}
