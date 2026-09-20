import { describe, expect, it } from 'vitest';
import { NoteNotFoundError } from '../domain/errors.js';
import { Note } from '../domain/note.js';
import { InMemoryNoteRepository } from '../testing/fakes.js';
import { GetNoteUseCase } from './get-note.use-case.js';

describe('GetNoteUseCase', () => {
  it('returns the note', async () => {
    const notes = new InMemoryNoteRepository();
    const note = Note.create({ title: 'a' }, new Date());
    await notes.save(note);

    expect(await new GetNoteUseCase(notes).execute(note.id)).toBe(note);
  });

  it('throws NOTE_NOT_FOUND for an unknown id', async () => {
    const useCase = new GetNoteUseCase(new InMemoryNoteRepository());

    await expect(useCase.execute('gone')).rejects.toThrow(NoteNotFoundError);
  });
});
