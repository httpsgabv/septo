import { Injectable } from '@nestjs/common';
import { UnauthenticatedError } from '../domain/errors.js';
import type { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';

@Injectable()
export class GetMeUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthenticatedError();
    return user;
  }
}
