import { describe, expect, it } from 'vitest';
import { NoteEmptyError, NoteNotFoundError } from '../domain/errors.js';
import { Note } from '../domain/note.js';
import { InMemoryNoteRepository } from '../testing/fakes.js';
import { UpdateNoteUseCase } from './update-note.use-case.js';

const created = new Date('2026-09-20T10:00:00Z');
const now = new Date('2026-09-20T12:00:00Z');
const reminder = new Date('2026-10-01T09:00:00Z');

const setup = async () => {
  const notes = new InMemoryNoteRepository();
  const note = Note.create(
    { title: 'Título', body: 'Corpo', tags: ['a'], remindAt: reminder },
    created,
  );
  await notes.save(note);
  const useCase = new UpdateNoteUseCase(notes);
  useCase.now = () => now;
  return { notes, note, useCase };
};

describe('UpdateNoteUseCase', () => {
  it('applies the fields sent and persists', async () => {
    const { notes, note, useCase } = await setup();

    const updated = await useCase.execute({ id: note.id, title: 'Novo', tags: ['B'] });

    expect(updated).toMatchObject({ title: 'Novo', body: 'Corpo', tags: ['b'], updatedAt: now });
    expect(notes.notes.get(note.id)).toMatchObject({ title: 'Novo' });
  });

  it('leaves an absent remindAt alone and clears it with null', async () => {
    const { note, useCase } = await setup();

    await useCase.execute({ id: note.id, title: 'Novo' });
    expect(note.remindAt).toEqual(reminder);

    await useCase.execute({ id: note.id, remindAt: null });
    expect(note.remindAt).toBeNull();
  });

  it('rejects an edit that leaves title and body empty, without saving', async () => {
    const { notes, note, useCase } = await setup();
    const savesBefore = notes.saves;

    await expect(useCase.execute({ id: note.id, title: '', body: '  ' })).rejects.toThrow(
      NoteEmptyError,
    );
    expect(notes.saves).toBe(savesBefore);
    expect(note.title).toBe('Título');
  });

  it('throws NOTE_NOT_FOUND for an unknown id', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ id: 'gone', title: 'x' })).rejects.toThrow(NoteNotFoundError);
  });
  it('uses the real clock by default', async () => {
    const { notes, note } = await setup();
    const before = Date.now();

    await new UpdateNoteUseCase(notes).execute({ id: note.id, title: 'Novo' });

    expect(note.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
