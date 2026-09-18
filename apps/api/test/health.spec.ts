import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, it } from 'vitest';
import { configureApp } from '../src/app.js';
import { AppModule } from '../src/app.module.js';
import { ENV, loadEnv } from '../src/shared/env.js';

async function createTestApp(databaseUrl?: string) {
  const env = loadEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue({ ...env, DATABASE_URL: databaseUrl ?? env.DATABASE_URL })
    .compile();
  const app = configureApp(moduleRef.createNestApplication({ logger: false }));
  await app.init();
  return app;
}

describe('GET /api/health', () => {
  let app: INestApplication;
  afterEach(() => app.close());

  it('returns 200 when the database is reachable', async () => {
    app = await createTestApp();
    await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok', db: 'up' });
  });

  it('returns 503 when the database is unreachable', async () => {
    app = await createTestApp('postgresql://septo:septo@127.0.0.1:1/septo');
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(503, { status: 'degraded', db: 'down' });
  });
});
