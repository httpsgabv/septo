import { PasswordHasher } from '../domain/password-hasher.js';
import { type SessionClaims, TokenService } from '../domain/token-service.js';
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
  /** Every hash `verify` was asked to check, to prove the work is done even for unknown users. */
  readonly verified: string[] = [];

  hash(password: string) {
    return Promise.resolve(`hashed:${password}`);
  }
  verify(password: string, hash: string) {
    this.verified.push(hash);
    return Promise.resolve(hash === `hashed:${password}`);
  }
}

/** Tokens are opaque handles into a map, so tests choose claims and issue dates freely. */
export class FakeTokenService extends TokenService {
  private readonly issued = new Map<string, SessionClaims>();

  issue(claims: { userId: string; version: number }) {
    return this.issueAt(claims, new Date());
  }
  issueAt(claims: { userId: string; version: number }, issuedAt: Date) {
    const token = `token-${this.issued.size + 1}`;
    this.issued.set(token, { ...claims, issuedAt });
    return Promise.resolve(token);
  }
  verify(token: string) {
    return Promise.resolve(this.issued.get(token) ?? null);
  }
}
