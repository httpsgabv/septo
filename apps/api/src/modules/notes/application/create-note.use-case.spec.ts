import { describe, expect, it } from 'vitest';
import { InvalidTagError, NoteEmptyError } from '../domain/errors.js';
import { InMemoryNoteRepository } from '../testing/fakes.js';
import { CreateNoteUseCase } from './create-note.use-case.js';

const now = new Date('2026-09-20T10:00:00Z');

const setup = () => {
  const notes = new InMemoryNoteRepository();
  const useCase = new CreateNoteUseCase(notes);
  useCase.now = () => now;
  return { notes, useCase };
};

describe('CreateNoteUseCase', () => {
  it('creates and persists the note with the clock of the use case', async () => {
    const { notes, useCase } = setup();

    const note = await useCase.execute({ title: 'Título', body: 'Corpo', tags: ['Casa'] });

    expect(note).toMatchObject({ title: 'Título', body: 'Corpo', tags: ['casa'], createdAt: now });
    expect(notes.notes.get(note.id)).toBe(note);
  });

  it('rejects an empty note without saving', async () => {
    const { notes, useCase } = setup();

    await expect(useCase.execute({ title: ' ', body: '' })).rejects.toThrow(NoteEmptyError);
    expect(notes.saves).toBe(0);
  });

  it('rejects invalid tags without saving', async () => {
    const { notes, useCase } = setup();

    await expect(useCase.execute({ title: 'a', tags: ['a/b'] })).rejects.toThrow(InvalidTagError);
    expect(notes.saves).toBe(0);
  });
});
