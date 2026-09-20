import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseEnv } from '../../../shared/env.js';
import { JoseTokenService } from './jose-token-service.js';

const SECRET = 'a-test-secret-with-at-least-32-characters';
const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-09-20T10:00:00.000Z');
const userId = '7f1c2b3a-0000-4000-8000-000000000001';

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const key = (secret: string) => new TextEncoder().encode(secret);

describe('JoseTokenService', () => {
  let service: JoseTokenService;
  let now: Date;

  beforeEach(() => {
    now = T0;
    service = new JoseTokenService(parseEnv({ JWT_SECRET: SECRET }));
    service.now = () => now;
  });

  it('issues a token that verifies to the same claims', async () => {
    const token = await service.issue({ userId, version: 3 });

    expect(await service.verify(token)).toEqual({ userId, version: 3, issuedAt: T0 });
  });

  it('accepts the token until 30 days after it was issued', async () => {
    const token = await service.issue({ userId, version: 0 });

    now = new Date(T0.getTime() + 29 * DAY);
    expect(await service.verify(token)).not.toBeNull();
    now = new Date(T0.getTime() + 30 * DAY + 1000);
    expect(await service.verify(token)).toBeNull();
  });

  it('rejects a token with a tampered payload', async () => {
    const [header, , signature] = (await service.issue({ userId, version: 0 })).split('.');
    const forged = `${header}.${b64url({ sub: 'someone-else', ver: 0, iat: 1, exp: 9_999_999_999 })}.${signature}`;

    expect(await service.verify(forged)).toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    const token = await new SignJWT({ ver: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt(T0)
      .setExpirationTime(new Date(T0.getTime() + DAY))
      .sign(key('another-secret-with-at-least-32-characters'));

    expect(await service.verify(token)).toBeNull();
  });

  it('rejects other algorithms, including unsigned tokens', async () => {
    const hs512 = await new SignJWT({ ver: 0 })
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject(userId)
      .setIssuedAt(T0)
      .setExpirationTime(new Date(T0.getTime() + DAY))
      .sign(key(SECRET));
    const unsigned = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
      sub: userId,
      ver: 0,
      iat: T0.getTime() / 1000,
      exp: T0.getTime() / 1000 + 3600,
    })}.`;

    expect(await service.verify(hs512)).toBeNull();
    expect(await service.verify(unsigned)).toBeNull();
  });

  it.each([
    ['without ver', { sub: userId }],
    ['with a non-numeric ver', { sub: userId, ver: 'x' }],
    ['without sub', { ver: 0 }],
  ])('rejects a correctly signed token %s', async (_case, claims) => {
    const { sub, ...custom } = claims as { sub?: string };
    const builder = new SignJWT(custom)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(T0)
      .setExpirationTime(new Date(T0.getTime() + DAY));
    if (sub) builder.setSubject(sub);

    expect(await service.verify(await builder.sign(key(SECRET)))).toBeNull();
  });

  it.each(['', 'not-a-jwt', 'a.b.c'])('rejects garbage (%j)', async (garbage) => {
    expect(await service.verify(garbage)).toBeNull();
  });
});
