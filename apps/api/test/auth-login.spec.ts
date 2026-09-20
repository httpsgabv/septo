import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.js';
import { AppModule } from '../src/app.module.js';
import { TIMING_DECOY_HASH } from '../src/modules/identity/application/login.use-case.js';
import { SetUserUseCase } from '../src/modules/identity/application/set-user.use-case.js';
import { PasswordHasher } from '../src/modules/identity/domain/password-hasher.js';
import { PrismaService } from '../src/shared/prisma.service.js';

const PASSWORD = 'a-long-password-1';
let ipCounter = 0;
/** Each test uses its own client IP, since the limiter lives as long as the app. */
const nextIp = () => `203.0.113.${++ipCounter}`;

describe('auth login and logout', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const post = (path: string, ip = nextIp()) =>
    request(app.getHttpServer()).post(path).set('X-Forwarded-For', ip);
  const login = (body: object, ip?: string) => post('/api/auth/login', ip).send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    await app.get(SetUserUseCase).execute({ username: 'gabriel', password: PASSWORD });
  });

  afterAll(() => app.close());

  describe('POST /api/auth/login', () => {
    it('signs in, returns the profile and sets the session cookie', async () => {
      const res = await login({ username: 'gabriel', password: PASSWORD }, '198.51.100.9').expect(
        200,
      );

      expect(res.body).toMatchObject({
        username: 'gabriel',
        displayName: 'gabriel',
        lastLoginIp: '198.51.100.9',
      });
      expect(res.body.lastLoginAt).toEqual(expect.any(String));
      expect(Object.keys(res.body).sort()).toEqual(
        ['displayName', 'id', 'lastLoginAt', 'lastLoginIp', 'username'].sort(),
      );
      const [cookie] = res.headers['set-cookie'] ?? [];
      expect(cookie).toMatch(/^septo_session=[\w-]+\.[\w-]+\.[\w-]+;/);
      expect(cookie).toContain('Max-Age=2592000');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('gives a cookie that opens protected routes', async () => {
      const res = await login({ username: 'gabriel', password: PASSWORD });
      const session = (res.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';

      await request(app.getHttpServer()).get('/api/me').set('Cookie', session).expect(200);
    });

    it('persists the last login', async () => {
      await login({ username: 'gabriel', password: PASSWORD }, '198.51.100.9');

      const stored = await prisma.user.findFirstOrThrow();
      expect(stored.lastLoginIp).toBe('198.51.100.9');
      expect(stored.lastLoginAt).toBeInstanceOf(Date);
    });

    it('answers a wrong password and an unknown user identically', async () => {
      const wrongPassword = await login({ username: 'gabriel', password: 'wrong-password-000' });
      const unknownUser = await login({ username: 'nobody', password: PASSWORD });

      expect(wrongPassword.status).toBe(401);
      expect(unknownUser.status).toBe(401);
      expect(unknownUser.body).toEqual(wrongPassword.body);
      expect(wrongPassword.body).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      });
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });

    it('blocks the 6th attempt of the same IP with 429 and Retry-After, even with the right password', async () => {
      const ip = nextIp();
      for (let i = 0; i < 5; i++) {
        await login({ username: 'gabriel', password: 'wrong-password-000' }, ip).expect(401);
      }

      const res = await login({ username: 'gabriel', password: PASSWORD }, ip).expect(429);

      expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
      const retryAfter = Number(res.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(900);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('does not block other IPs', async () => {
      const ip = nextIp();
      for (let i = 0; i < 5; i++) {
        await login({ username: 'gabriel', password: 'wrong-password-000' }, ip);
      }

      await login({ username: 'gabriel', password: PASSWORD }).expect(200);
    });

    it('resets the counter after a successful login', async () => {
      const ip = nextIp();
      const wrong = { username: 'gabriel', password: 'wrong-password-000' };
      for (let i = 0; i < 4; i++) await login(wrong, ip).expect(401);
      await login({ username: 'gabriel', password: PASSWORD }, ip).expect(200);

      for (let i = 0; i < 4; i++) await login(wrong, ip).expect(401);
    });

    it('trusts only the last hop of X-Forwarded-For (the proxy), so it cannot be spoofed', async () => {
      const res = await login(
        { username: 'gabriel', password: PASSWORD },
        '198.51.100.66, 203.0.113.200',
      );

      expect(res.body.lastLoginIp).toBe('203.0.113.200');
    });

    it('stores "unknown" instead of an address that is not an IP', async () => {
      const res = await login({ username: 'gabriel', password: PASSWORD }, 'not-an-ip');

      expect(res.body.lastLoginIp).toBe('unknown');
    });

    it.each([
      ['no body', {}],
      ['no password', { username: 'gabriel' }],
      ['an empty username', { username: '', password: PASSWORD }],
      ['a non-string password', { username: 'gabriel', password: 12345678901234 }],
      ['a huge password', { username: 'gabriel', password: 'x'.repeat(129) }],
    ])('rejects %s with 400', async (_case, body) => {
      const res = await login(body).expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('never echoes the password back', async () => {
      const res = await login({ username: 'gabriel', password: 'wrong-password-000' });

      expect(JSON.stringify(res.body)).not.toContain('wrong-password-000');
    });

    it('only accepts JSON bodies, which shuts out cross-site form posts', async () => {
      for (const contentType of ['application/x-www-form-urlencoded', 'text/plain']) {
        const res = await post('/api/auth/login')
          .set('Content-Type', contentType)
          .send(`username=gabriel&password=${PASSWORD}`)
          .expect(415);

        expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
        expect(res.headers['set-cookie']).toBeUndefined();
      }
    });
  });

  describe('POST /api/auth/logout', () => {
    it('expires the cookie', async () => {
      const res = await post('/api/auth/logout').expect(204);

      const [cookie] = res.headers['set-cookie'] ?? [];
      expect(cookie).toMatch(/^septo_session=;/);
      expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
      expect(cookie).toContain('HttpOnly');
    });

    it('works without a session, so a stale cookie can always be cleared', async () => {
      await post('/api/auth/logout').set('Cookie', 'septo_session=garbage').expect(204);
    });
  });

  it('keeps the decoy hash in step with the real hash parameters', async () => {
    const real = await app.get(PasswordHasher).hash('anything-at-all-1');

    expect(TIMING_DECOY_HASH.split('$').slice(0, 4)).toEqual(real.split('$').slice(0, 4));
  });
});
