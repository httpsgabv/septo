import { describe, expect, it } from 'vitest';
import { NoteNotFoundError } from '../domain/errors.js';
import { Note } from '../domain/note.js';
import { InMemoryNoteRepository } from '../testing/fakes.js';
import { SetNoteArchivedUseCase } from './set-note-archived.use-case.js';

const created = new Date('2026-09-20T10:00:00Z');
const now = new Date('2026-09-20T12:00:00Z');

const setup = async () => {
  const notes = new InMemoryNoteRepository();
  const note = Note.create({ title: 'a' }, created);
  await notes.save(note);
  const useCase = new SetNoteArchivedUseCase(notes);
  useCase.now = () => now;
  return { note, useCase };
};

describe('SetNoteArchivedUseCase', () => {
  it('archives and unarchives, returning the updated note without touching updatedAt', async () => {
    const { note, useCase } = await setup();

    const archived = await useCase.execute({ id: note.id, archived: true });
    expect(archived.archivedAt).toEqual(now);
    expect(archived.updatedAt).toEqual(created);

    const unarchived = await useCase.execute({ id: note.id, archived: false });
    expect(unarchived.archivedAt).toBeNull();
  });

  it('throws NOTE_NOT_FOUND for an unknown id', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ id: 'gone', archived: true })).rejects.toThrow(
      NoteNotFoundError,
    );
  });
});
