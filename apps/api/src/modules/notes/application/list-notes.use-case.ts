import { Injectable } from '@nestjs/common';
import type { Note } from '../domain/note.js';
import { NoteRepository, type NotesView } from '../domain/note.repository.js';
import { normalizeSearchText } from '../domain/search-text.js';
import { normalizeTag } from '../domain/tags.js';

@Injectable()
export class ListNotesUseCase {
  constructor(private readonly notes: NoteRepository) {}

  /**
   * Turns the raw filters into the normalized criteria the repository expects. Ordering and the
   * 200-note ceiling belong to the repository (see the port).
   */
  async execute(input: { q?: string; tag?: string; view?: NotesView }): Promise<Note[]> {
    const query = normalizeSearchText(input.q?.trim() ?? '') || undefined;
    let tag: string | undefined;
    if (input.tag?.trim()) {
      try {
        tag = normalizeTag(input.tag);
      } catch {
        // No note can carry an invalid tag, so filtering by one matches nothing.
        return [];
      }
    }
    return this.notes.list({ query, tag, view: input.view ?? 'active' });
  }
}
