import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../../shared/env.js';
import { PrismaService } from '../../../shared/prisma.service.js';
import { Note, type NoteInput } from '../domain/note.js';
import { NOTES_LIST_LIMIT } from '../domain/note.repository.js';
import { normalizeSearchText } from '../domain/search-text.js';
import { PrismaNoteRepository } from './note.prisma-repository.js';

const prisma = new PrismaService(loadEnv());
const repository = new PrismaNoteRepository(prisma);

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 8, 20, hour, minute));

/** Saves a note created at `createdAt`; `after` pins/archives it (which keeps `updatedAt`). */
async function add(input: NoteInput, createdAt: Date, after?: (note: Note) => void) {
  const note = Note.create(input, createdAt);
  after?.(note);
  await repository.save(note);
  return note;
}
const titles = async (criteria: Parameters<typeof repository.list>[0]) =>
  (await repository.list(criteria)).map((note) => note.title);

describe('PrismaNoteRepository', () => {
  beforeEach(() => prisma.note.deleteMany());
  afterAll(() => prisma.$disconnect());

  describe('save and findById', () => {
    it('stores a note and reads every field back', async () => {
      const note = await add(
        { title: 'Anotação', body: '## Corpo', tags: ['a', 'b'], remindAt: at(15) },
        at(10),
        (n) => n.setPinned(true, at(11)),
      );

      const found = await repository.findById(note.id);

      expect(found).toBeInstanceOf(Note);
      expect(found).toMatchObject({
        id: note.id,
        title: 'Anotação',
        body: '## Corpo',
        tags: ['a', 'b'],
        pinnedAt: at(11),
        archivedAt: null,
        remindAt: at(15),
        createdAt: at(10),
        updatedAt: at(10),
      });
      expect(found?.searchText).toBe(note.searchText);
    });

    it('persists searchText derived by the entity', async () => {
      const note = await add({ title: 'Anotação', body: 'Corpo' }, at(10));

      const row = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });

      expect(row.searchText).toContain('anotacao');
    });

    it('updates an existing note, including nulling nullable fields', async () => {
      const note = await add({ title: 'a', remindAt: at(15) }, at(10), (n) =>
        n.setArchived(true, at(11)),
      );

      note.edit({ title: 'b', tags: ['x'], remindAt: null }, at(12));
      note.setArchived(false, at(13));
      await repository.save(note);

      expect(await repository.findById(note.id)).toMatchObject({
        title: 'b',
        tags: ['x'],
        remindAt: null,
        archivedAt: null,
        createdAt: at(10),
        updatedAt: at(12),
      });
      expect(await prisma.note.count()).toBe(1);
    });

    it('returns null for an unknown id and for one that is not a uuid', async () => {
      expect(await repository.findById('7f1c2b3a-0000-4000-8000-000000000000')).toBeNull();
      expect(await repository.findById('not-a-uuid')).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the note and reports it', async () => {
      const note = await add({ title: 'a' }, at(10));

      expect(await repository.delete(note.id)).toBe(true);
      expect(await repository.findById(note.id)).toBeNull();
    });

    it('reports false for an unknown id and for one that is not a uuid', async () => {
      expect(await repository.delete('7f1c2b3a-0000-4000-8000-000000000000')).toBe(false);
      expect(await repository.delete('not-a-uuid')).toBe(false);
    });
  });

  describe('list: views', () => {
    it('active leaves archived notes out; archived shows only them', async () => {
      await add({ title: 'ativa' }, at(10));
      await add({ title: 'arquivada' }, at(11), (n) => n.setArchived(true, at(12)));

      expect(await titles({ view: 'active' })).toEqual(['ativa']);
      expect(await titles({ view: 'archived' })).toEqual(['arquivada']);
    });

    it('reminders: non-archived notes with a reminder, by remindAt ascending', async () => {
      await add({ title: 'sem lembrete' }, at(10));
      await add({ title: 'depois', remindAt: at(20) }, at(11));
      await add({ title: 'antes', remindAt: at(12) }, at(12));
      await add({ title: 'arquivada', remindAt: at(1) }, at(13), (n) =>
        n.setArchived(true, at(14)),
      );

      expect(await titles({ view: 'reminders' })).toEqual(['antes', 'depois']);
    });
  });

  describe('list: order', () => {
    it('puts pinned notes first (most recently pinned first), then by updatedAt desc', async () => {
      await add({ title: 'velha' }, at(1));
      await add({ title: 'recente' }, at(5));
      await add({ title: 'fixada antes' }, at(0), (n) => n.setPinned(true, at(6)));
      await add({ title: 'fixada depois' }, at(0), (n) => n.setPinned(true, at(8)));

      expect(await titles({ view: 'active' })).toEqual([
        'fixada depois',
        'fixada antes',
        'recente',
        'velha',
      ]);
    });

    it('does not reorder by pinning: updatedAt stays the creation time', async () => {
      const note = await add({ title: 'a' }, at(1));
      await add({ title: 'b' }, at(2));

      note.setPinned(true, at(9));
      await repository.save(note);
      note.setPinned(false, at(10));
      await repository.save(note);

      expect(await titles({ view: 'active' })).toEqual(['b', 'a']);
    });
  });

  describe('list: search', () => {
    it('matches title and body by substring, ignoring accents and case (query arrives normalized)', async () => {
      await add({ title: 'Anotação' }, at(1));
      await add({ title: 'outra', body: 'texto com ANOTAÇÃO' }, at(2));
      await add({ title: 'nada' }, at(3));

      expect(
        (await titles({ view: 'active', query: normalizeSearchText('anotacao') })).sort(),
      ).toEqual(['Anotação', 'outra']);
      expect(
        (await titles({ view: 'active', query: normalizeSearchText('ANOTAÇÃO') })).sort(),
      ).toEqual(['Anotação', 'outra']);
    });

    it('matches a substring in the middle of a word', async () => {
      await add({ title: 'reuniões' }, at(1));

      expect(await titles({ view: 'active', query: 'unio' })).toEqual(['reuniões']);
      expect(await titles({ view: 'active', query: 'uniao' })).toEqual([]);
    });

    it.each(['%', '_', '\\'])('treats %j as plain text, not as a wildcard', async (query) => {
      await add({ title: 'sem curinga' }, at(1));
      await add({ title: '100% pronto', body: 'snake_case e c:\\dir' }, at(2));

      expect(await titles({ view: 'active', query })).toEqual(['100% pronto']);
    });

    it('filters by tag, and combines with the query', async () => {
      await add({ title: 'reunião', tags: ['trabalho', 'x'] }, at(1));
      await add({ title: 'reunião de pais', tags: ['casa'] }, at(2));
      await add({ title: 'relatório', tags: ['trabalho'] }, at(3));

      expect((await titles({ view: 'active', tag: 'trabalho' })).sort()).toEqual([
        'relatório',
        'reunião',
      ]);
      expect(await titles({ view: 'active', tag: 'trabalho', query: 'reuniao' })).toEqual([
        'reunião',
      ]);
      expect(await titles({ view: 'active', tag: 'inexistente' })).toEqual([]);
    });
  });

  describe('list: ceiling', () => {
    it('returns at most NOTES_LIST_LIMIT notes, the most recent ones', async () => {
      const total = NOTES_LIST_LIMIT + 5;
      await prisma.note.createMany({
        data: Array.from({ length: total }, (_, i) => ({
          id: crypto.randomUUID(),
          title: `n${i}`,
          body: '',
          searchText: `n${i}\n`,
          createdAt: at(0, i % 60),
          updatedAt: new Date(Date.UTC(2026, 8, 20, 0, 0, i)),
        })),
      });

      const listed = await titles({ view: 'active' });

      expect(listed).toHaveLength(NOTES_LIST_LIMIT);
      expect(listed[0]).toBe(`n${total - 1}`);
      expect(listed).not.toContain('n0');
    });
  });

  describe('listTags', () => {
    it('returns each tag once, alphabetical, ignoring archived notes', async () => {
      await add({ title: 'a', tags: ['trabalho', 'casa'] }, at(1));
      await add({ title: 'b', tags: ['casa', 'ideia'] }, at(2));
      await add({ title: 'c', tags: ['so-arquivada', 'casa'] }, at(3), (n) =>
        n.setArchived(true, at(4)),
      );

      expect(await repository.listTags()).toEqual(['casa', 'ideia', 'trabalho']);
    });

    it('is empty without notes', async () => {
      expect(await repository.listTags()).toEqual([]);
    });
  });
});
