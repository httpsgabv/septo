import { describe, expect, it } from 'vitest';
import { NoteNotFoundError } from '../domain/errors.js';
import { Note } from '../domain/note.js';
import { InMemoryNoteRepository } from '../testing/fakes.js';
import { SetNotePinnedUseCase } from './set-note-pinned.use-case.js';

const created = new Date('2026-09-20T10:00:00Z');
const now = new Date('2026-09-20T12:00:00Z');

const setup = async () => {
  const notes = new InMemoryNoteRepository();
  const note = Note.create({ title: 'a' }, created);
  await notes.save(note);
  const useCase = new SetNotePinnedUseCase(notes);
  useCase.now = () => now;
  return { note, useCase };
};

describe('SetNotePinnedUseCase', () => {
  it('pins and unpins, returning the updated note without touching updatedAt', async () => {
    const { note, useCase } = await setup();

    const pinned = await useCase.execute({ id: note.id, pinned: true });
    expect(pinned.pinnedAt).toEqual(now);
    expect(pinned.updatedAt).toEqual(created);

    const unpinned = await useCase.execute({ id: note.id, pinned: false });
    expect(unpinned.pinnedAt).toBeNull();
  });

  it('throws NOTE_NOT_FOUND for an unknown id', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ id: 'gone', pinned: true })).rejects.toThrow(NoteNotFoundError);
  });
});
