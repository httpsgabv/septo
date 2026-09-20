import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/shared/prisma.service.js';
import { createTestApp, resetUser } from './support.js';

describe('PATCH /api/me', () => {
  let app: INestApplication;
  let session: string;
  const patch = (body: object) =>
    request(app.getHttpServer()).patch('/api/me').set('Cookie', session).send(body);

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    session = await (await resetUser(app)).newSession();
  });
  afterAll(() => app.close());

  it('changes the display name and returns the profile', async () => {
    const res = await patch({ displayName: 'Gabriel B.' }).expect(200);

    expect(res.body).toMatchObject({ username: 'gabriel', displayName: 'Gabriel B.' });
    await request(app.getHttpServer())
      .get('/api/me')
      .set('Cookie', session)
      .expect(200)
      .expect((r) => expect(r.body.displayName).toBe('Gabriel B.'));
  });

  it('accepts 1 and 50 characters', async () => {
    await patch({ displayName: 'a' }).expect(200);
    await patch({ displayName: 'a'.repeat(50) }).expect(200);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['51 characters', 'a'.repeat(51)],
    ['a leading space', ' Gabriel'],
    ['a trailing space', 'Gabriel '],
    ['a trailing newline', 'Gabriel\n'],
    ['a number', 42],
  ])('rejects %s with 400 and keeps the current name', async (_case, displayName) => {
    const res = await patch({ displayName }).expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
    const stored = await app.get(PrismaService).user.findFirstOrThrow();
    expect(stored.displayName).toBe('gabriel');
  });

  it('never writes anything but the display name', async () => {
    const before = await app.get(PrismaService).user.findFirstOrThrow();

    await patch({
      displayName: 'Gabriel B.',
      username: 'attacker',
      tokenVersion: 99,
      passwordHash: 'x',
    }).expect(200);

    const after = await app.get(PrismaService).user.findFirstOrThrow();
    expect(after.username).toBe('gabriel');
    expect(after.tokenVersion).toBe(before.tokenVersion);
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('needs a session', async () => {
    await request(app.getHttpServer()).patch('/api/me').send({ displayName: 'X' }).expect(401);
  });
});
