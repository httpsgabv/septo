import { Controller, type INestApplication, Post, Res } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.js';
import {
  clearSessionCookie,
  setSessionCookie,
} from '../src/modules/identity/presentation/session-cookie.js';

@Controller('cookie')
class CookieController {
  @Post('set')
  set(@Res({ passthrough: true }) res: Response) {
    setSessionCookie(res, 'the-token');
  }

  @Post('clear')
  clear(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
  }
}

describe('session cookie', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [CookieController] }).compile();
    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
  });

  afterAll(() => app.close());

  it('is httpOnly, secure, lax, site-wide and lasts 30 days', async () => {
    const res = await request(app.getHttpServer()).post('/api/cookie/set');

    const [cookie] = res.headers['set-cookie'] ?? [];
    expect(cookie).toMatch(/^septo_session=the-token;/);
    expect(cookie).toContain('Max-Age=2592000');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('is cleared with the same attributes, expired in the past', async () => {
    const res = await request(app.getHttpServer()).post('/api/cookie/clear');

    const [cookie] = res.headers['set-cookie'] ?? [];
    expect(cookie).toMatch(/^septo_session=;/);
    expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });
});
