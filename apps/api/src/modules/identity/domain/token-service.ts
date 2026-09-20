export type SessionClaims = { userId: string; version: number; issuedAt: Date };

export abstract class TokenService {
  abstract issue(claims: { userId: string; version: number }): Promise<string>;
  /** `null` for anything that is not a valid, unexpired token signed by us. */
  abstract verify(token: string): Promise<SessionClaims | null>;
}
