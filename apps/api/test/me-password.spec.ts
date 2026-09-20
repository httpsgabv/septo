import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/shared/prisma.service.js';
import { createTestApp, PASSWORD, resetUser } from './support.js';

const NEXT = 'brand-new-password-2';
let ipCounter = 0;

describe('PUT /api/me/password', () => {
  let app: INestApplication;
  let thisDevice: string;
  let otherDevice: string;
  const http = () => request(app.getHttpServer());
  const change = (body: object, cookie = thisDevice) =>
    http().put('/api/me/password').set('Cookie', cookie).send(body);
  const login = (password: string) =>
    http()
      .post('/api/auth/login')
      .set('X-Forwarded-For', `198.51.100.${++ipCounter}`)
      .send({ username: 'gabriel', password });
  const sessionFrom = (res: request.Response) =>
    (res.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    const { newSession } = await resetUser(app);
    thisDevice = await newSession();
    otherDevice = await newSession();
  });
  afterAll(() => app.close());

  it('changes the password, signs out the other device and keeps this one', async () => {
    const res = await change({ currentPassword: PASSWORD, newPassword: NEXT }).expect(204);

    const [setCookie] = res.headers['set-cookie'] ?? [];
    expect(setCookie).toMatch(/^septo_session=/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Max-Age=2592000');
    await http().get('/api/me').set('Cookie', otherDevice).expect(401);
    await http().get('/api/me').set('Cookie', thisDevice).expect(401); // the old cookie of this device too…
    await http().get('/api/me').set('Cookie', sessionFrom(res)).expect(200); // …but the reissued one works
  });

  it('makes the old password stop working and the new one work', async () => {
    await change({ currentPassword: PASSWORD, newPassword: NEXT }).expect(204);

    await login(PASSWORD).expect(401);
    await login(NEXT).expect(200);
  });

  it('refuses a wrong current password with 422 and leaves every session alive', async () => {
    const res = await change({ currentPassword: 'not-the-password-9', newPassword: NEXT }).expect(
      422,
    );

    expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(res.headers['set-cookie']).toBeUndefined();
    await http().get('/api/me').set('Cookie', thisDevice).expect(200);
    await http().get('/api/me').set('Cookie', otherDevice).expect(200);
    await login(PASSWORD).expect(200);
  });

  it.each([
    ['too short (11)', { currentPassword: PASSWORD, newPassword: 'a'.repeat(11) }],
    ['too long (129)', { currentPassword: PASSWORD, newPassword: 'a'.repeat(129) }],
    ['missing', { currentPassword: PASSWORD }],
    ['without the current password', { newPassword: NEXT }],
  ])('rejects a new password that is %s with 400', async (_case, body) => {
    const res = await change(body).expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
    const stored = await app.get(PrismaService).user.findFirstOrThrow();
    expect(stored.tokenVersion).toBe(0);
  });

  it('accepts the 12 and 128 character limits', async () => {
    const res = await change({ currentPassword: PASSWORD, newPassword: 'a'.repeat(12) }).expect(
      204,
    );
    await change(
      { currentPassword: 'a'.repeat(12), newPassword: 'b'.repeat(128) },
      sessionFrom(res),
    ).expect(204);
  });

  it('needs a session', async () => {
    await http()
      .put('/api/me/password')
      .send({ currentPassword: PASSWORD, newPassword: NEXT })
      .expect(401);
  });

  it('never echoes passwords back', async () => {
    const res = await change({ currentPassword: 'not-the-password-9', newPassword: NEXT });

    expect(JSON.stringify(res.body)).not.toMatch(/not-the-password-9|brand-new-password-2/);
  });
});
