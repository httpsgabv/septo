import { Injectable } from '@nestjs/common';
import { UnauthenticatedError } from '../domain/errors.js';
import { UserRepository } from '../domain/user.repository.js';

@Injectable()
export class RevokeSessionsUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthenticatedError();
    user.revokeSessions();
    await this.users.save(user);
  }
}
