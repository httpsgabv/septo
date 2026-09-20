import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { ENV, type Env } from '../../../shared/env.js';
import { SESSION_MAX_AGE_SECONDS } from '../domain/session.js';
import { type SessionClaims, TokenService } from '../domain/token-service.js';

/** HS256 JWT: `sub` = user id, `ver` = the user's `tokenVersion`, plus `iat` and `exp`. */
@Injectable()
export class JoseTokenService extends TokenService {
  private readonly key: Uint8Array;
  /** Replaced in tests to move through time. */
  now = () => new Date();

  constructor(@Inject(ENV) env: Env) {
    super();
    this.key = new TextEncoder().encode(env.JWT_SECRET);
  }

  issue(claims: { userId: string; version: number }) {
    const issuedAt = this.now();
    return new SignJWT({ ver: claims.version })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(new Date(issuedAt.getTime() + SESSION_MAX_AGE_SECONDS * 1000))
      .sign(this.key);
  }

  async verify(token: string): Promise<SessionClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        currentDate: this.now(),
      });
      const { sub, ver, iat } = payload;
      if (typeof sub !== 'string' || !Number.isInteger(ver) || typeof iat !== 'number') return null;
      return { userId: sub, version: ver as number, issuedAt: new Date(iat * 1000) };
    } catch {
      return null;
    }
  }
}
