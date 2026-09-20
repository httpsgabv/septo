import { PasswordHasher } from '../domain/password-hasher.js';
import type { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';

export class InMemoryUserRepository extends UserRepository {
  readonly users = new Map<string, User>();
  saves = 0;

  findById(id: string) {
    return Promise.resolve(this.users.get(id) ?? null);
  }
  findByUsername(username: string) {
    return Promise.resolve([...this.users.values()].find((u) => u.username === username) ?? null);
  }
  findFirst() {
    return Promise.resolve([...this.users.values()][0] ?? null);
  }
  save(user: User) {
    this.saves += 1;
    this.users.set(user.id, user);
    return Promise.resolve();
  }
}

/** Deterministic and instant; argon2 has its own spec. */
export class FakePasswordHasher extends PasswordHasher {
  hash(password: string) {
    return Promise.resolve(`hashed:${password}`);
  }
  verify(password: string, hash: string) {
    return Promise.resolve(hash === `hashed:${password}`);
  }
}
