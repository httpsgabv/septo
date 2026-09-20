import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/shared/prisma.service.js';
import { createTestApp, resetUser } from './support.js';

const MISSING_ID = '7f1c2b3a-0000-4000-8000-000000000000';

describe('notes HTTP', () => {
  let app: INestApplication;
  let session: string;

  const http = () => request(app.getHttpServer());
  const get = (path: string) => http().get(path).set('Cookie', session);
  const post = (path: string, body?: object) => http().post(path).set('Cookie', session).send(body);
  const patch = (path: string, body: object) =>
    http().patch(path).set('Cookie', session).send(body);
  const del = (path: string) => http().delete(path).set('Cookie', session);

  /** Creates through the API; the returned note carries the id and the server's timestamps. */
  const create = async (body: object) => (await post('/api/notes', body).expect(201)).body;
  const titles = async (query = '') =>
    (await get(`/api/notes${query}`).expect(200)).body.map((note: { title: string }) => note.title);

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    session = await (await resetUser(app)).newSession();
    await app.get(PrismaService).note.deleteMany();
  });
  afterAll(() => app.close());

  describe('authentication', () => {
    it.each([
      ['GET', '/api/notes'],
      ['POST', '/api/notes'],
      ['GET', `/api/notes/${MISSING_ID}`],
      ['PATCH', `/api/notes/${MISSING_ID}`],
      ['POST', `/api/notes/${MISSING_ID}/pin`],
      ['DELETE', `/api/notes/${MISSING_ID}/pin`],
      ['POST', `/api/notes/${MISSING_ID}/archive`],
      ['DELETE', `/api/notes/${MISSING_ID}/archive`],
      ['DELETE', `/api/notes/${MISSING_ID}`],
      ['GET', '/api/tags'],
    ])('%s %s answers 401 without a session cookie', async (method, path) => {
      const req = http()[method.toLowerCase() as 'get'](path);
      const res = await (method === 'GET' || method === 'DELETE' ? req : req.send({ title: 'x' }));

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('answers 401 for a session that was revoked', async () => {
      const { user, newSession } = await resetUser(app);
      const stale = await newSession();
      await app.get(PrismaService).user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });

      await http().get('/api/notes').set('Cookie', stale).expect(401);
    });
  });

  describe('GET /api/notes', () => {
    it('is an empty list on a clean database', async () => {
      const res = await get('/api/notes').expect(200);

      expect(res.body).toEqual([]);
    });

    it('lists summaries: no body, an excerpt of 160 characters, booleans for pinned/archived', async () => {
      const note = await create({ title: 'Título', body: 'x'.repeat(500), tags: ['a'] });

      const [summary] = (await get('/api/notes').expect(200)).body;

      expect(summary).toEqual({
        id: note.id,
        title: 'Título',
        excerpt: 'x'.repeat(160),
        tags: ['a'],
        pinned: false,
        archived: false,
        remindAt: null,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      });
      expect(summary).not.toHaveProperty('body');
    });

    it('does not cut an emoji in half at the end of the excerpt', async () => {
      await create({ title: 't', body: `${'x'.repeat(159)}😀 depois` });

      const [summary] = (await get('/api/notes').expect(200)).body;

      expect(summary.excerpt).toBe('x'.repeat(159));
    });

    it('finds notes by title and body, ignoring accents and case', async () => {
      await create({ title: 'Anotação' });
      await create({ title: 'outra', body: 'no corpo: ANOTAÇÃO' });
      await create({ title: 'nada a ver' });

      expect((await titles('?q=anotacao')).sort()).toEqual(['Anotação', 'outra']);
      expect((await titles(`?q=${encodeURIComponent('  ANOTAÇÃO ')}`)).sort()).toEqual([
        'Anotação',
        'outra',
      ]);
    });

    it('treats a blank q as no filter and % as plain text', async () => {
      await create({ title: 'a' });
      await create({ title: '100% pronto' });

      expect(await titles('?q=')).toHaveLength(2);
      expect(await titles(`?q=${encodeURIComponent('%')}`)).toEqual(['100% pronto']);
    });

    it('filters by tag, whatever the case or spacing of the tag in the URL', async () => {
      await create({ title: 'trabalho', tags: ['trabalho'] });
      await create({ title: 'casa', tags: ['casa'] });

      expect(await titles('?tag=trabalho')).toEqual(['trabalho']);
      expect(await titles(`?tag=${encodeURIComponent(' Trabalho ')}`)).toEqual(['trabalho']);
      expect(await titles(`?tag=${encodeURIComponent('a/b')}`)).toEqual([]);
    });

    it('lists pinned notes first, without changing when they were edited', async () => {
      const old = await create({ title: 'antiga' });
      await create({ title: 'recente' });

      const pinned = (await post(`/api/notes/${old.id}/pin`).expect(200)).body;

      expect(await titles()).toEqual(['antiga', 'recente']);
      expect(pinned.updatedAt).toBe(old.updatedAt);
    });

    it('view=archived lists only archived notes; the default view leaves them out', async () => {
      const note = await create({ title: 'velha' });
      await create({ title: 'ativa' });
      await post(`/api/notes/${note.id}/archive`).expect(200);

      expect(await titles()).toEqual(['ativa']);
      expect(await titles('?view=archived')).toEqual(['velha']);
    });

    it('view=reminders lists non-archived notes with a reminder, soonest first', async () => {
      await create({ title: 'sem lembrete' });
      await create({ title: 'depois', remindAt: '2030-01-02T09:00:00.000Z' });
      await create({ title: 'antes', remindAt: '2030-01-01T09:00:00.000Z' });
      const archived = await create({ title: 'arquivada', remindAt: '2029-01-01T09:00:00.000Z' });
      await post(`/api/notes/${archived.id}/archive`).expect(200);

      expect(await titles('?view=reminders')).toEqual(['antes', 'depois']);
    });

    it('caps the list at 200 notes', async () => {
      await app.get(PrismaService).note.createMany({
        data: Array.from({ length: 205 }, (_, i) => ({
          id: crypto.randomUUID(),
          title: `n${i}`,
          body: '',
          searchText: `n${i}\n`,
          createdAt: new Date(),
          updatedAt: new Date(Date.UTC(2026, 8, 20, 0, 0, i)),
        })),
      });

      expect(await titles()).toHaveLength(200);
    });

    it.each([
      ['an unknown view', '?view=trash'],
      ['a q over 200 characters', `?q=${'a'.repeat(201)}`],
    ])('rejects %s with 400', async (_case, query) => {
      const res = await get(`/api/notes${query}`).expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/notes', () => {
    it('creates a note and answers 201 with the full note', async () => {
      const res = await post('/api/notes', {
        title: 'Título',
        body: '## Corpo',
        tags: ['  Trabalho ', 'trabalho', 'TRABALHO', 'a b'],
        remindAt: '2030-01-01T09:00:00.000Z',
      }).expect(201);

      expect(res.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        title: 'Título',
        body: '## Corpo',
        tags: ['trabalho', 'a-b'],
        pinned: false,
        archived: false,
        remindAt: '2030-01-01T09:00:00.000Z',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(res.body.createdAt).toBe(res.body.updatedAt);
    });

    it('stores the body as markdown, readable as it was sent', async () => {
      const markdown = '## Título\n\n- item\n- **negrito**\n\n> citação';
      const note = await create({ title: 't', body: markdown });

      const row = await app.get(PrismaService).note.findUniqueOrThrow({ where: { id: note.id } });

      expect(row.body).toBe(markdown);
      expect(row.searchText).toContain('citacao');
    });

    it('never lets the client set searchText, id or timestamps', async () => {
      const res = await post('/api/notes', {
        title: 'Real',
        searchText: 'forjado',
        id: MISSING_ID,
        createdAt: '2000-01-01T00:00:00.000Z',
      }).expect(201);

      const row = await app
        .get(PrismaService)
        .note.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.searchText).not.toContain('forjado');
      expect(res.body.id).not.toBe(MISSING_ID);
      expect(res.body.createdAt).not.toBe('2000-01-01T00:00:00.000Z');
    });

    it.each([
      ['no fields', {}],
      ['empty title and body', { title: '', body: '' }],
      ['only spaces', { title: '   ', body: '\n' }],
      ['only tags', { tags: ['a'] }],
    ])('answers 422 NOTE_EMPTY for %s, and stores nothing', async (_case, body) => {
      const res = await post('/api/notes', body).expect(422);

      expect(res.body.code).toBe('NOTE_EMPTY');
      expect(await app.get(PrismaService).note.count()).toBe(0);
    });

    it('answers 422 INVALID_TAG for a tag with an invalid character', async () => {
      const res = await post('/api/notes', { title: 'a', tags: ['a/b'] }).expect(422);

      expect(res.body.code).toBe('INVALID_TAG');
    });

    it.each([
      ['a title over 200 characters', { title: 'a'.repeat(201) }],
      ['a body over 100000 characters', { title: 'a', body: 'a'.repeat(100_001) }],
      ['more than 10 tags', { title: 'a', tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }],
      ['a remindAt that is not an ISO date', { title: 'a', remindAt: 'amanhã' }],
      ['a title that is not a string', { title: 42 }],
    ])('rejects %s with 400', async (_case, body) => {
      const res = await post('/api/notes', body).expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(await app.get(PrismaService).note.count()).toBe(0);
    });

    it('accepts limits exactly: 200-character title, 10 tags', async () => {
      await post('/api/notes', {
        title: 'a'.repeat(200),
        tags: Array.from({ length: 10 }, (_, i) => `t${i}`),
      }).expect(201);
    });

    it('accepts a reminder in the past', async () => {
      const res = await post('/api/notes', { title: 'a', remindAt: '2020-01-01T00:00:00.000Z' });

      expect(res.status).toBe(201);
    });

    it('only accepts JSON bodies, which shuts out cross-site form posts', async () => {
      for (const contentType of ['application/x-www-form-urlencoded', 'text/plain']) {
        const res = await http()
          .post('/api/notes')
          .set('Cookie', session)
          .set('Content-Type', contentType)
          .send('title=x')
          .expect(415);

        expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      }
      expect(await app.get(PrismaService).note.count()).toBe(0);
    });
  });

  describe('GET /api/notes/:id', () => {
    it('returns the full note', async () => {
      const note = await create({ title: 'Título', body: 'Corpo' });

      const res = await get(`/api/notes/${note.id}`).expect(200);

      expect(res.body).toEqual(note);
    });

    it.each([MISSING_ID, 'not-a-uuid'])('answers 404 NOTE_NOT_FOUND for %s', async (id) => {
      const res = await get(`/api/notes/${id}`).expect(404);

      expect(res.body.code).toBe('NOTE_NOT_FOUND');
    });
  });

  describe('PATCH /api/notes/:id', () => {
    it('changes only the fields sent', async () => {
      const note = await create({
        title: 'Título',
        body: 'Corpo',
        tags: ['a'],
        remindAt: '2030-01-01T09:00:00.000Z',
      });

      const res = await patch(`/api/notes/${note.id}`, { title: 'Novo' }).expect(200);

      expect(res.body).toMatchObject({
        title: 'Novo',
        body: 'Corpo',
        tags: ['a'],
        remindAt: '2030-01-01T09:00:00.000Z',
        createdAt: note.createdAt,
      });
      expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(note.updatedAt).getTime(),
      );
      expect((await get(`/api/notes/${note.id}`)).body.title).toBe('Novo');
    });

    it('remindAt: null clears the reminder and drops the note from view=reminders', async () => {
      const note = await create({ title: 'a', remindAt: '2030-01-01T09:00:00.000Z' });
      expect(await titles('?view=reminders')).toEqual(['a']);

      const res = await patch(`/api/notes/${note.id}`, { remindAt: null }).expect(200);

      expect(res.body.remindAt).toBeNull();
      expect(await titles('?view=reminders')).toEqual([]);
    });

    it('replaces the tags and normalizes them', async () => {
      const note = await create({ title: 'a', tags: ['antiga'] });

      const res = await patch(`/api/notes/${note.id}`, { tags: [' Nova ', 'nova'] }).expect(200);

      expect(res.body.tags).toEqual(['nova']);
    });

    it('is a no-op for an empty patch: 200 and updatedAt unchanged', async () => {
      const note = await create({ title: 'a' });

      const res = await patch(`/api/notes/${note.id}`, {}).expect(200);

      expect(res.body).toEqual(note);
    });

    it('recalculates the search after a change of title', async () => {
      const note = await create({ title: 'Antigo' });
      await patch(`/api/notes/${note.id}`, { title: 'Ação' }).expect(200);

      expect(await titles('?q=acao')).toEqual(['Ação']);
      expect(await titles('?q=antigo')).toEqual([]);
    });

    it('answers 422 NOTE_EMPTY when it would leave title and body empty, and changes nothing', async () => {
      const note = await create({ title: 'só título' });

      const res = await patch(`/api/notes/${note.id}`, { title: '' }).expect(422);

      expect(res.body.code).toBe('NOTE_EMPTY');
      expect((await get(`/api/notes/${note.id}`)).body.title).toBe('só título');
    });

    it('answers 400 for invalid input and 404 for a missing note', async () => {
      const note = await create({ title: 'a' });

      await patch(`/api/notes/${note.id}`, { title: 'a'.repeat(201) }).expect(400);
      const missing = await patch(`/api/notes/${MISSING_ID}`, { title: 'x' }).expect(404);
      expect(missing.body.code).toBe('NOTE_NOT_FOUND');
      await patch('/api/notes/not-a-uuid', { title: 'x' }).expect(404);
    });

    it('only accepts JSON bodies', async () => {
      const note = await create({ title: 'a' });

      await http()
        .patch(`/api/notes/${note.id}`)
        .set('Cookie', session)
        .set('Content-Type', 'text/plain')
        .send('title=x')
        .expect(415);
    });
  });

  describe('pin and archive', () => {
    it.each([
      ['pin', 'pinned'],
      ['archive', 'archived'],
    ])('POST and DELETE on :id/%s toggle %s, answering 200 with the note', async (on, flag) => {
      const note = await create({ title: 'a' });

      const enabled = await post(`/api/notes/${note.id}/${on}`).expect(200);
      expect(enabled.body[flag]).toBe(true);
      expect(enabled.body.updatedAt).toBe(note.updatedAt);

      const disabled = await del(`/api/notes/${note.id}/${on}`).expect(200);
      expect(disabled.body[flag]).toBe(false);
    });

    it('is idempotent: doing it twice is fine', async () => {
      const note = await create({ title: 'a' });

      await post(`/api/notes/${note.id}/pin`).expect(200);
      const again = await post(`/api/notes/${note.id}/pin`).expect(200);

      expect(again.body.pinned).toBe(true);
    });

    it('archiving brings the note back on unarchive', async () => {
      const note = await create({ title: 'a' });
      await post(`/api/notes/${note.id}/archive`).expect(200);
      expect(await titles()).toEqual([]);

      await del(`/api/notes/${note.id}/archive`).expect(200);

      expect(await titles()).toEqual(['a']);
    });

    it.each(['POST', 'DELETE'])(
      'answers 404 NOTE_NOT_FOUND on %s for a missing note',
      async (method) => {
        for (const action of ['pin', 'archive']) {
          const res = await http()
            [method.toLowerCase() as 'post'](`/api/notes/${MISSING_ID}/${action}`)
            .set('Cookie', session)
            .expect(404);

          expect(res.body.code).toBe('NOTE_NOT_FOUND');
        }
      },
    );
  });

  describe('DELETE /api/notes/:id', () => {
    it('removes the note for good: 204, then 404', async () => {
      const note = await create({ title: 'a' });

      await del(`/api/notes/${note.id}`).expect(204);

      await get(`/api/notes/${note.id}`).expect(404);
      expect(await app.get(PrismaService).note.count()).toBe(0);
    });

    it.each([MISSING_ID, 'not-a-uuid'])('answers 404 NOTE_NOT_FOUND for %s', async (id) => {
      const res = await del(`/api/notes/${id}`).expect(404);

      expect(res.body.code).toBe('NOTE_NOT_FOUND');
    });
  });

  describe('GET /api/tags', () => {
    it('lists each tag once, alphabetical, leaving out archived notes', async () => {
      await create({ title: 'a', tags: ['trabalho', 'casa'] });
      await create({ title: 'b', tags: ['casa', 'ideia'] });
      const archived = await create({ title: 'c', tags: ['so-arquivada'] });
      await post(`/api/notes/${archived.id}/archive`).expect(200);

      const res = await get('/api/tags').expect(200);

      expect(res.body).toEqual(['casa', 'ideia', 'trabalho']);
    });

    it('is an empty list without notes', async () => {
      expect((await get('/api/tags').expect(200)).body).toEqual([]);
    });

    it('is not swallowed by /notes/:id (a note id is never "tags")', async () => {
      await get('/api/notes/tags').expect(404);
    });
  });
});
