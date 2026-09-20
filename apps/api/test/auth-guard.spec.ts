import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.js';
import { AppModule } from '../src/app.module.js';
import { PasswordHasher } from '../src/modules/identity/domain/password-hasher.js';
import { TokenService } from '../src/modules/identity/domain/token-service.js';
import { User } from '../src/modules/identity/domain/user.js';
import { UserRepository } from '../src/modules/identity/domain/user.repository.js';
import type { JoseTokenService } from '../src/modules/identity/infrastructure/jose-token-service.js';
import { createOpenApiDocument, serveApiDocs } from '../src/openapi.js';
import { PrismaService } from '../src/shared/prisma.service.js';

const DAY = 24 * 60 * 60 * 1000;

/** No @Public(): proves that a route added tomorrow is protected by default. */
@Controller('probe')
class ProbeController {
  @Get()
  probe() {
    return { ok: true };
  }
}

describe('AuthGuard', () => {
  let app: INestApplication;
  let tokens: JoseTokenService;
  let users: UserRepository;
  let user: User;
  let prisma: PrismaService;

  /** Issues a token as if it had been issued `daysAgo` days ago. */
  async function tokenIssuedDaysAgo(daysAgo: number, version = user.tokenVersion) {
    const realNow = tokens.now;
    tokens.now = () => new Date(Date.now() - daysAgo * DAY);
    const token = await tokens.issue({ userId: user.id, version });
    tokens.now = realNow;
    return token;
  }
  const cookie = (token: string) => `septo_session=${token}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    serveApiDocs(app, createOpenApiDocument(app));
    await app.init();
    tokens = app.get(TokenService) as JoseTokenService;
    users = app.get(UserRepository);
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    user = User.create({
      username: 'gabriel',
      passwordHash: await app.get(PasswordHasher).hash('a-long-password-1'),
    });
    await users.save(user);
  });

  afterAll(() => app.close());

  describe('public routes', () => {
    it('serves health and the API docs without a session', async () => {
      await request(app.getHttpServer()).get('/api/health').expect(200);
      await request(app.getHttpServer()).get('/api/openapi.json').expect(200);
      await request(app.getHttpServer()).get('/api/docs').expect(200);
    });
  });

  describe('protected by default', () => {
    it('rejects a request without a cookie', async () => {
      await request(app.getHttpServer())
        .get('/api/probe')
        .expect(401, { code: 'UNAUTHENTICATED', message: 'Authentication required' });
      await request(app.getHttpServer()).get('/api/me').expect(401);
    });

    it('rejects a tampered token', async () => {
      const token = await tokenIssuedDaysAgo(0);

      await request(app.getHttpServer())
        .get('/api/me')
        .set('Cookie', cookie(`${token.slice(0, -3)}abc`))
        .expect(401);
    });

    it('rejects an expired token (older than 30 days)', async () => {
      await request(app.getHttpServer())
        .get('/api/me')
        .set('Cookie', cookie(await tokenIssuedDaysAgo(31)))
        .expect(401);
    });

    it('rejects a token from an older tokenVersion', async () => {
      const token = await tokenIssuedDaysAgo(0);
      user.revokeSessions();
      await users.save(user);

      await request(app.getHttpServer()).get('/api/me').set('Cookie', cookie(token)).expect(401);
    });

    it('rejects a token of a deleted user', async () => {
      const token = await tokenIssuedDaysAgo(0);
      await prisma.user.deleteMany();

      await request(app.getHttpServer()).get('/api/me').set('Cookie', cookie(token)).expect(401);
    });

    it('lets a valid session through', async () => {
      await request(app.getHttpServer())
        .get('/api/probe')
        .set('Cookie', cookie(await tokenIssuedDaysAgo(0)))
        .expect(200, { ok: true });
    });
  });

  describe('GET /api/me', () => {
    it('returns exactly the public profile', async () => {
      const at = new Date('2026-09-19T12:00:00.000Z');
      user.recordLogin('203.0.113.7', at);
      await users.save(user);

      const { body } = await request(app.getHttpServer())
        .get('/api/me')
        .set('Cookie', cookie(await tokenIssuedDaysAgo(0)))
        .expect(200);

      expect(body).toEqual({
        id: user.id,
        username: 'gabriel',
        displayName: 'gabriel',
        lastLoginAt: '2026-09-19T12:00:00.000Z',
        lastLoginIp: '203.0.113.7',
      });
    });

    it('returns null for a user that never logged in', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/me')
        .set('Cookie', cookie(await tokenIssuedDaysAgo(0)))
        .expect(200);

      expect(body).toMatchObject({ lastLoginAt: null, lastLoginIp: null });
    });
  });

  describe('sliding expiration', () => {
    it('does not touch the cookie of a token younger than 15 days', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/me')
        .set('Cookie', cookie(await tokenIssuedDaysAgo(14)))
        .expect(200);

      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('issues a fresh 30-day cookie for a token older than 15 days', async () => {
      const old = await tokenIssuedDaysAgo(16);

      const res = await request(app.getHttpServer())
        .get('/api/me')
        .set('Cookie', cookie(old))
        .expect(200);

      const [setCookie] = res.headers['set-cookie'] ?? [];
      expect(setCookie).toMatch(/^septo_session=[\w-]+\.[\w-]+\.[\w-]+;/);
      expect(setCookie).toContain('Max-Age=2592000');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('SameSite=Lax');
      const renewed = /^septo_session=([^;]+)/.exec(setCookie ?? '')?.[1] ?? '';
      expect(renewed).not.toBe(old);
      await request(app.getHttpServer()).get('/api/me').set('Cookie', cookie(renewed)).expect(200);
    });
  });
});
