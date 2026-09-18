import { Controller, Get, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createOpenApiDocument } from '../src/openapi.js';
import { ZodBody, ZodParams, ZodQuery, ZodResponse } from '../src/shared/http/zod.decorators.js';

const sampleItem = z
  .object({
    id: z.uuid(),
    title: z.string().optional(),
    body: z.string().nullable(),
    kind: z.enum(['note', 'reminder']),
    remindAt: z.iso.datetime(),
  })
  .meta({ id: 'SampleItem' });
const createSampleItem = z.object({ title: z.string().min(1), kind: z.enum(['note', 'reminder']) });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  tag: z.string().optional(),
});
const idParams = z.object({ id: z.uuid() });

@Controller('samples')
class SampleController {
  @Get()
  @ZodResponse(200, z.array(sampleItem))
  listSamples(@ZodQuery(listQuery) query: z.infer<typeof listQuery>) {
    return query;
  }

  @Get(':id')
  @ZodResponse(200, sampleItem)
  getSample(@ZodParams(idParams) { id }: z.infer<typeof idParams>) {
    return { id };
  }

  @Post()
  @ZodResponse(201, sampleItem)
  createSample(@ZodBody(createSampleItem) body: z.infer<typeof createSampleItem>) {
    return body;
  }
}

describe('zod → OpenAPI pipeline', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [SampleController] }).compile();
    app = moduleRef.createNestApplication({ logger: false }).setGlobalPrefix('api');
    await app.init();
  });

  afterAll(() => app.close());

  it('documents params, query, body, responses and named components', () => {
    const { paths, components } = createOpenApiDocument(app);
    expect({ paths, components }).toMatchSnapshot();
  });

  it('uses the controller method name as operationId', () => {
    const { paths } = createOpenApiDocument(app);
    expect(paths['/api/samples']?.get?.operationId).toBe('listSamples');
  });

  it('validates and parses each input source', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/samples?page=2').expect(200, { page: 2 });
    await request(server).get('/api/samples?page=0').expect(400);
    await request(server).get('/api/samples/not-a-uuid').expect(400);
    await request(server).post('/api/samples').send({ title: '', kind: 'x' }).expect(400);
    await request(server)
      .post('/api/samples')
      .send({ title: 'ok', kind: 'note', extra: true })
      .expect(201, { title: 'ok', kind: 'note' });
  });
});
