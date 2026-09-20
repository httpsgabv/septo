import type { Note } from './note.js';

export type NotesView = 'active' | 'archived' | 'reminders';

/**
 * `query` and `tag` arrive already normalized (`normalizeSearchText`, `normalizeTag`); the
 * repository only matches them against `searchText` (substring) and `tags`.
 */
export type ListNotesCriteria = { query?: string; tag?: string; view: NotesView };

// ponytail: busca por substring e teto de 200; trocar por tsvector + paginação por cursor quando a lista passar disso
export const NOTES_LIST_LIMIT = 200;

export abstract class NoteRepository {
  abstract findById(id: string): Promise<Note | null>;
  /**
   * Already ordered and capped at `NOTES_LIST_LIMIT`: `active` and `archived` list pinned notes
   * first (`pinnedAt` desc) then `updatedAt` desc; `reminders` is the non-archived notes with a
   * reminder, by `remindAt` asc.
   */
  abstract list(criteria: ListNotesCriteria): Promise<Note[]>;
  /** Distinct tags of non-archived notes, alphabetical. */
  abstract listTags(): Promise<string[]>;
  /** Inserts or updates by id. */
  abstract save(note: Note): Promise<void>;
  /** Returns whether a note was removed. */
  abstract delete(id: string): Promise<boolean>;
}
