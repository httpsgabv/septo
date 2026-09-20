export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  /** `false` for a wrong password or a malformed stored hash; never throws for bad input. */
  abstract verify(password: string, hash: string): Promise<boolean>;
}
