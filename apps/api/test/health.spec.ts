import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('GET /api/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(() => app.close());

  it('reports the API is up', () =>
    request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' }));
});
