import { describe, expect, it } from 'vitest';
import { Note, type NoteInput } from '../domain/note.js';
import { NOTES_LIST_LIMIT } from '../domain/note.repository.js';
import { InMemoryNoteRepository } from '../testing/fakes.js';
import { ListNotesUseCase } from './list-notes.use-case.js';

const at = (hour: number) => new Date(Date.UTC(2026, 8, 20, hour));

const setup = () => {
  const notes = new InMemoryNoteRepository();
  const useCase = new ListNotesUseCase(notes);
  /** Creates a note, then applies `after` (pin/archive) so the clock of each step is explicit. */
  const add = async (input: NoteInput, createdAt: Date, after?: (note: Note) => void) => {
    const note = Note.create(input, createdAt);
    after?.(note);
    await notes.save(note);
    return note;
  };
  const titles = async (input: Parameters<ListNotesUseCase['execute']>[0]) =>
    (await useCase.execute(input)).map((note) => note.title);
  return { notes, add, titles };
};

describe('ListNotesUseCase', () => {
  describe('views', () => {
    it('defaults to active: everything but archived notes', async () => {
      const { add, titles } = setup();
      await add({ title: 'ativa' }, at(1));
      await add({ title: 'arquivada' }, at(2), (n) => n.setArchived(true, at(3)));

      expect(await titles({})).toEqual(['ativa']);
      expect(await titles({ view: 'active' })).toEqual(['ativa']);
    });

    it('archived: only archived notes', async () => {
      const { add, titles } = setup();
      await add({ title: 'ativa' }, at(1));
      await add({ title: 'arquivada' }, at(2), (n) => n.setArchived(true, at(3)));

      expect(await titles({ view: 'archived' })).toEqual(['arquivada']);
    });

    it('reminders: non-archived notes with a reminder, by date ascending', async () => {
      const { add, titles } = setup();
      await add({ title: 'sem lembrete' }, at(1));
      await add({ title: 'depois', remindAt: at(20) }, at(2));
      await add({ title: 'antes', remindAt: at(10) }, at(3));
      await add({ title: 'arquivada', remindAt: at(5) }, at(4), (n) => n.setArchived(true, at(5)));

      expect(await titles({ view: 'reminders' })).toEqual(['antes', 'depois']);
    });
  });

  describe('search', () => {
    it('matches title and body, ignoring accents and case', async () => {
      const { add, titles } = setup();
      await add({ title: 'Anotação' }, at(1));
      await add({ title: 'outra', body: 'texto com ANOTAÇÃO no corpo' }, at(2));
      await add({ title: 'nada a ver' }, at(3));

      expect((await titles({ q: 'anotacao' })).sort()).toEqual(['Anotação', 'outra']);
      expect((await titles({ q: 'ANOTAÇÃO' })).sort()).toEqual(['Anotação', 'outra']);
    });

    it('trims the query and normalizes it before handing it to the repository', async () => {
      const { notes, add } = setup();
      await add({ title: 'a' }, at(1));

      await new ListNotesUseCase(notes).execute({ q: '  Ação ' });

      expect(notes.lastCriteria).toEqual({ query: 'acao', tag: undefined, view: 'active' });
    });

    it.each([undefined, '', '   '])('ignores a blank query (%j)', async (q) => {
      const { notes, add, titles } = setup();
      await add({ title: 'a' }, at(1));

      expect(await titles({ q })).toEqual(['a']);
      expect(notes.lastCriteria?.query).toBeUndefined();
    });
  });

  describe('tag', () => {
    it('filters by tag, normalizing the one asked for', async () => {
      const { add, titles } = setup();
      await add({ title: 'trabalho', tags: ['trabalho'] }, at(1));
      await add({ title: 'casa', tags: ['casa'] }, at(2));

      expect(await titles({ tag: ' Trabalho ' })).toEqual(['trabalho']);
    });

    it('matches nothing for an invalid tag instead of failing', async () => {
      const { add, titles } = setup();
      await add({ title: 'a', tags: ['a'] }, at(1));

      expect(await titles({ tag: 'a/b' })).toEqual([]);
    });

    it('ignores a blank tag', async () => {
      const { add, titles } = setup();
      await add({ title: 'a' }, at(1));

      expect(await titles({ tag: '  ' })).toEqual(['a']);
    });

    it('combines with q as an intersection', async () => {
      const { add, titles } = setup();
      await add({ title: 'reunião', tags: ['trabalho'] }, at(1));
      await add({ title: 'reunião de pais', tags: ['casa'] }, at(2));
      await add({ title: 'relatório', tags: ['trabalho'] }, at(3));

      expect(await titles({ q: 'reuniao', tag: 'trabalho' })).toEqual(['reunião']);
    });
  });

  describe('order and ceiling (the port contract, as followed by the fake)', () => {
    it('lists pinned notes first even with an older updatedAt, then the most recently edited', async () => {
      const { add, titles } = setup();
      await add({ title: 'antiga fixada' }, at(1), (n) => n.setPinned(true, at(9)));
      await add({ title: 'velha' }, at(2));
      await add({ title: 'recente' }, at(5));

      expect(await titles({})).toEqual(['antiga fixada', 'recente', 'velha']);
    });

    it('caps the list at NOTES_LIST_LIMIT', async () => {
      const { notes, add, titles } = setup();
      for (let i = 0; i < NOTES_LIST_LIMIT + 5; i++) await add({ title: `n${i}` }, at(1));

      expect(notes.notes.size).toBe(NOTES_LIST_LIMIT + 5);
      expect(await titles({})).toHaveLength(NOTES_LIST_LIMIT);
    });
  });
});
