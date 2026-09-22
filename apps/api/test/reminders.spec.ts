import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ENV, type Env } from '../src/shared/env.js';
import { PrismaService } from '../src/shared/prisma.service.js';
import { createTestApp, resetUser } from './support.js';

const MISSING_ID = '7f1c2b3a-0000-4000-8000-000000000000';
const input = {
  endpoint: 'https://push.example.test/subscriptions/secret',
  expirationTime: Date.parse('2026-10-22T12:00:00.000Z'),
  keys: { p256dh: 'public-key', auth: 'auth-secret' },
};

describe('reminders HTTP', () => {
  let app: INestApplication;
  let session: string;

  const http = () => request(app.getHttpServer());
  const get = (path: string) => http().get(path).set('Cookie', session);
  const put = (path: string, body: object) => http().put(path).set('Cookie', session).send(body);
  const del = (path: string) => http().delete(path).set('Cookie', session);

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    session = await (await resetUser(app)).newSession();
    await app.get(PrismaService).pushSubscription.deleteMany();
  });
  afterAll(() => app.close());

  it.each([
    ['GET', '/api/push/config'],
    ['PUT', '/api/push/subscriptions'],
    ['DELETE', `/api/push/subscriptions/${MISSING_ID}`],
  ])('%s %s answers 401 without a session', async (method, path) => {
    const req = http()[method.toLowerCase() as 'get'](path);
    const res = await (method === 'PUT' ? req.send(input) : req);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('GET /push/config exposes only the public key', async () => {
    const res = await get('/api/push/config').expect(200);

    expect(res.body).toEqual({ publicKey: app.get<Env>(ENV).VAPID_PUBLIC_KEY });
    expect(JSON.stringify(res.body)).not.toContain(app.get<Env>(ENV).VAPID_PRIVATE_KEY);
    expect(res.body).not.toHaveProperty('subject');
  });

  it('PUT /push/subscriptions upserts by endpoint and never echoes capability data', async () => {
    const first = await put('/api/push/subscriptions', input).expect(200);
    const second = await put('/api/push/subscriptions', {
      ...input,
      expirationTime: null,
      keys: { p256dh: 'new-public-key', auth: 'new-auth' },
    }).expect(200);

    expect(first.body).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(second.body).toEqual(first.body);
    expect(JSON.stringify(second.body)).not.toContain('push.example');
    expect(
      await app.get(PrismaService).pushSubscription.findUniqueOrThrow({
        where: { id: first.body.id },
      }),
    ).toMatchObject({
      endpoint: input.endpoint,
      expirationTime: null,
      p256dh: 'new-public-key',
      auth: 'new-auth',
    });
  });

  it.each([
    ['HTTP endpoint', { ...input, endpoint: 'http://push.example.test/x' }],
    ['endpoint over 2048 chars', { ...input, endpoint: `https://x.test/${'a'.repeat(2040)}` }],
    ['invalid public key', { ...input, keys: { ...input.keys, p256dh: 'not base64!' } }],
    ['oversized auth', { ...input, keys: { ...input.keys, auth: 'a'.repeat(129) } }],
    ['non-number expiration', { ...input, expirationTime: 'tomorrow' }],
  ])('rejects %s with 400 without storing it', async (_case, body) => {
    const res = await put('/api/push/subscriptions', body).expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await app.get(PrismaService).pushSubscription.count()).toBe(0);
  });

  it('DELETE /push/subscriptions/:id is idempotent and validates the id', async () => {
    const { body } = await put('/api/push/subscriptions', input).expect(200);

    await del(`/api/push/subscriptions/${body.id}`).expect(204);
    await del(`/api/push/subscriptions/${body.id}`).expect(204);
    await del(`/api/push/subscriptions/${MISSING_ID}`).expect(204);
    await del('/api/push/subscriptions/not-a-uuid').expect(400);

    expect(await app.get(PrismaService).pushSubscription.count()).toBe(0);
  });
});
