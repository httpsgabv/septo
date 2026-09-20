import type { Note as NoteRecord } from '../../../generated/prisma/client.js';
import { Note } from '../domain/note.js';

export function toDomain(record: NoteRecord): Note {
  return Note.restore({
    id: record.id,
    title: record.title,
    body: record.body,
    tags: record.tags,
    pinnedAt: record.pinnedAt,
    archivedAt: record.archivedAt,
    remindAt: record.remindAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

/** Both timestamps come from the entity: the model has no defaults for them. */
export function toRecord(note: Note): NoteRecord {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    searchText: note.searchText,
    tags: [...note.tags],
    pinnedAt: note.pinnedAt,
    archivedAt: note.archivedAt,
    remindAt: note.remindAt,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}
