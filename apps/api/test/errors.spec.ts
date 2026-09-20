import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { configureApp } from '../src/app.js';
import { createOpenApiDocument } from '../src/openapi.js';
import { DomainError } from '../src/shared/domain-error.js';
import { ZodQuery } from '../src/shared/http/zod.decorators.js';

class ThingNotFoundError extends DomainError {
  readonly code = 'THING_NOT_FOUND';
  readonly kind = 'not_found';
  constructor() {
    super('Thing not found');
  }
}

class ThingAlreadyArchivedError extends DomainError {
  readonly code = 'THING_ALREADY_ARCHIVED';
  readonly kind = 'conflict';
  constructor() {
    super('Thing is already archived');
  }
}

class NeedsLoginError extends DomainError {
  readonly code = 'UNAUTHENTICATED';
  readonly kind = 'unauthenticated';
  constructor() {
    super('Sign in first');
  }
}

class SlowDownError extends DomainError {
  readonly code = 'TOO_MANY_ATTEMPTS';
  readonly kind = 'rate_limited';
  readonly retryAfterSeconds = 42;
  constructor() {
    super('Slow down');
  }
}

@Controller('things')
class ThingsController {
  @Get('missing')
  missing() {
    throw new ThingNotFoundError();
  }

  @Get('archived')
  archived() {
    throw new ThingAlreadyArchivedError();
  }

  @Get('login')
  login() {
    throw new NeedsLoginError();
  }

  @Get('slow')
  slow() {
    throw new SlowDownError();
  }

  @Get('boom')
  boom() {
    throw new Error('database password is hunter2');
  }

  @Get()
  list(@ZodQuery(z.object({ page: z.coerce.number().int().min(1) })) query: unknown) {
    return query;
  }
}

describe('error responses', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ThingsController] }).compile();
    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
  });

  afterAll(() => app.close());

  it('maps domain errors to HTTP status by kind', async () => {
    await request(app.getHttpServer())
      .get('/api/things/missing')
      .expect(404, { code: 'THING_NOT_FOUND', message: 'Thing not found' });
    await request(app.getHttpServer())
      .get('/api/things/archived')
      .expect(409, { code: 'THING_ALREADY_ARCHIVED', message: 'Thing is already archived' });
  });

  it('maps unauthenticated to 401', async () => {
    await request(app.getHttpServer())
      .get('/api/things/login')
      .expect(401, { code: 'UNAUTHENTICATED', message: 'Sign in first' });
  });

  it('maps rate_limited to 429 with Retry-After', async () => {
    await request(app.getHttpServer())
      .get('/api/things/slow')
      .expect(429, { code: 'TOO_MANY_ATTEMPTS', message: 'Slow down' })
      .expect('Retry-After', '42');
  });

  it('keeps the validation error shape', async () => {
    const { body } = await request(app.getHttpServer()).get('/api/things?page=0').expect(400);
    expect(body).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ path: 'page' }] });
  });

  it('normalizes framework HTTP errors', async () => {
    await request(app.getHttpServer())
      .get('/api/nope')
      .expect(404, { code: 'NOT_FOUND', message: 'Cannot GET /api/nope' });
  });

  it('hides unexpected errors behind a generic 500', async () => {
    await request(app.getHttpServer())
      .get('/api/things/boom')
      .expect(500, { code: 'INTERNAL_ERROR', message: 'Unexpected error' });
  });

  it('documents ErrorResponse and the 400 of validated inputs', () => {
    const { components, paths } = createOpenApiDocument(app);
    expect(components?.schemas?.ErrorResponse).toBeDefined();
    expect(paths['/api/things']?.get?.responses['400']).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
    });
  });
});
