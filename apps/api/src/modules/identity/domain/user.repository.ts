import type { User } from './user.js';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByUsername(username: string): Promise<User | null>;
  /** septo has a single user; the CLI uses this to decide between create and reset. */
  abstract findFirst(): Promise<User | null>;
  /** Inserts or updates by id. */
  abstract save(user: User): Promise<void>;
}
