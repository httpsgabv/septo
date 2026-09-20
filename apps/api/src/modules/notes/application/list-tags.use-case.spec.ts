import { describe, expect, it } from 'vitest';
import { Note } from '../domain/note.js';
import { InMemoryNoteRepository } from '../testing/fakes.js';
import { ListTagsUseCase } from './list-tags.use-case.js';

const now = new Date('2026-09-20T10:00:00Z');

describe('ListTagsUseCase', () => {
  it('lists each tag once, alphabetically', async () => {
    const notes = new InMemoryNoteRepository();
    await notes.save(Note.create({ title: 'a', tags: ['casa', 'trabalho'] }, now));
    await notes.save(Note.create({ title: 'b', tags: ['trabalho', 'ideia'] }, now));

    expect(await new ListTagsUseCase(notes).execute()).toEqual(['casa', 'ideia', 'trabalho']);
  });

  // Intentional (SPEC-notes): a tag that lives only in archived notes leaves the filter until the
  // note is unarchived.
  it('ignores the tags of archived notes', async () => {
    const notes = new InMemoryNoteRepository();
    await notes.save(Note.create({ title: 'ativa', tags: ['casa'] }, now));
    const archived = Note.create({ title: 'velha', tags: ['casa', 'so-arquivada'] }, now);
    archived.setArchived(true, now);
    await notes.save(archived);

    expect(await new ListTagsUseCase(notes).execute()).toEqual(['casa']);
  });

  it('is empty without notes', async () => {
    expect(await new ListTagsUseCase(new InMemoryNoteRepository()).execute()).toEqual([]);
  });
});
