import { describe, expect, it } from 'vitest';
import { NoteNotFoundError } from '../domain/errors.js';
import { Note } from '../domain/note.js';
import { InMemoryNoteRepository } from '../testing/fakes.js';
import { DeleteNoteUseCase } from './delete-note.use-case.js';

describe('DeleteNoteUseCase', () => {
  it('removes the note for good', async () => {
    const notes = new InMemoryNoteRepository();
    const note = Note.create({ title: 'a' }, new Date());
    await notes.save(note);

    await new DeleteNoteUseCase(notes).execute(note.id);

    expect(notes.notes.has(note.id)).toBe(false);
  });

  it('throws NOTE_NOT_FOUND for an unknown id', async () => {
    const useCase = new DeleteNoteUseCase(new InMemoryNoteRepository());

    await expect(useCase.execute('gone')).rejects.toThrow(NoteNotFoundError);
  });
});
