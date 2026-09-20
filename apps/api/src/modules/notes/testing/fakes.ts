import type { Note } from '../domain/note.js';
import {
  type ListNotesCriteria,
  NOTES_LIST_LIMIT,
  NoteRepository,
} from '../domain/note.repository.js';

/**
 * Stores and returns notes. `list` follows the contract documented on the port (filter, order,
 * cap) so the use cases can be tested; the real ordering and filtering are proven against Postgres
 * in the repository's integration spec.
 */
export class InMemoryNoteRepository extends NoteRepository {
  readonly notes = new Map<string, Note>();
  saves = 0;
  lastCriteria: ListNotesCriteria | undefined;

  findById(id: string) {
    return Promise.resolve(this.notes.get(id) ?? null);
  }

  list(criteria: ListNotesCriteria) {
    this.lastCriteria = criteria;
    const { query, tag, view } = criteria;
    const matches = [...this.notes.values()].filter(
      (note) =>
        (view === 'archived' ? note.archivedAt !== null : note.archivedAt === null) &&
        (view !== 'reminders' || note.remindAt !== null) &&
        (!query || note.searchText.includes(query)) &&
        (!tag || note.tags.includes(tag)),
    );
    const time = (date: Date | null) => date?.getTime() ?? Number.NEGATIVE_INFINITY;
    matches.sort((a, b) =>
      view === 'reminders'
        ? time(a.remindAt) - time(b.remindAt)
        : time(b.pinnedAt) - time(a.pinnedAt) || time(b.updatedAt) - time(a.updatedAt),
    );
    return Promise.resolve(matches.slice(0, NOTES_LIST_LIMIT));
  }

  listTags() {
    const tags = new Set<string>();
    for (const note of this.notes.values()) {
      if (note.archivedAt === null) for (const tag of note.tags) tags.add(tag);
    }
    return Promise.resolve([...tags].sort());
  }

  save(note: Note) {
    this.saves += 1;
    this.notes.set(note.id, note);
    return Promise.resolve();
  }

  delete(id: string) {
    return Promise.resolve(this.notes.delete(id));
  }
}
