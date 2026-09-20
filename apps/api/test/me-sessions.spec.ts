import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, PASSWORD, resetUser } from './support.js';

describe('DELETE /api/me/sessions', () => {
  let app: INestApplication;
  let newSession: () => Promise<string>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    ({ newSession } = await resetUser(app));
  });
  afterAll(() => app.close());

  it('signs out every device, including the caller, and expires its cookie', async () => {
    const thisDevice = await newSession();
    const otherDevice = await newSession();

    const res = await http().delete('/api/me/sessions').set('Cookie', thisDevice).expect(204);

    const [cookie] = res.headers['set-cookie'] ?? [];
    expect(cookie).toMatch(/^septo_session=;/);
    expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    await http().get('/api/me').set('Cookie', thisDevice).expect(401);
    await http().get('/api/me').set('Cookie', otherDevice).expect(401);
  });

  it('lets the user sign in again afterwards', async () => {
    await http()
      .delete('/api/me/sessions')
      .set('Cookie', await newSession())
      .expect(204);

    const res = await http()
      .post('/api/auth/login')
      .set('X-Forwarded-For', '198.51.100.77')
      .send({ username: 'gabriel', password: PASSWORD })
      .expect(200);

    const session = (res.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
    await http().get('/api/me').set('Cookie', session).expect(200);
  });

  it('needs a session', async () => {
    await http().delete('/api/me/sessions').expect(401);
  });
});
