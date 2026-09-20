import { z } from 'zod';
import type { Note, NoteInput } from '../domain/note.js';
import { MAX_TAGS } from '../domain/tags.js';

export const TITLE_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 100_000;
export const QUERY_MAX_LENGTH = 200;
export const EXCERPT_LENGTH = 160;

const remindAt = z.iso.datetime().nullable();

const shared = {
  id: z.uuid(),
  title: z.string(),
  tags: z.array(z.string()),
  pinned: z.boolean(),
  archived: z.boolean(),
  remindAt,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

export const noteResponse = z.object({ ...shared, body: z.string() }).meta({ id: 'Note' });
export type NoteResponse = z.infer<typeof noteResponse>;

/** A `Note` without its `body`, with an `excerpt` for the list. */
export const noteSummaryResponse = z
  .object({ ...shared, excerpt: z.string() })
  .meta({ id: 'NoteSummary' });
export type NoteSummaryResponse = z.infer<typeof noteSummaryResponse>;

function toShared(note: Note) {
  return {
    id: note.id,
    title: note.title,
    tags: [...note.tags],
    pinned: note.pinnedAt !== null,
    archived: note.archivedAt !== null,
    remindAt: note.remindAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export function toNoteResponse(note: Note): NoteResponse {
  return { ...toShared(note), body: note.body };
}

// ponytail: trecho é markdown cru fatiado; renderizar para texto puro se ficar feio
function excerptOf(body: string): string {
  const excerpt = body.slice(0, EXCERPT_LENGTH);
  // Do not leave half of a surrogate pair at the cut.
  return /[\uD800-\uDBFF]$/.test(excerpt) ? excerpt.slice(0, -1) : excerpt;
}

export function toNoteSummaryResponse(note: Note): NoteSummaryResponse {
  return { ...toShared(note), excerpt: excerptOf(note.body) };
}

const noteFields = {
  title: z.string().max(TITLE_MAX_LENGTH).optional(),
  body: z.string().max(BODY_MAX_LENGTH).optional(),
  tags: z.array(z.string()).max(MAX_TAGS).optional(),
  remindAt: remindAt.optional(),
};

export const createNoteRequest = z.object(noteFields).meta({ id: 'CreateNoteRequest' });
export type CreateNoteRequest = z.infer<typeof createNoteRequest>;

/** A field left out does not change; `remindAt: null` clears the reminder. */
export const updateNoteRequest = z.object(noteFields).meta({ id: 'UpdateNoteRequest' });
export type UpdateNoteRequest = z.infer<typeof updateNoteRequest>;

/** The wire carries `remindAt` as an ISO string; the domain wants a Date (or null to clear). */
export function toNoteInput(body: CreateNoteRequest | UpdateNoteRequest): NoteInput {
  const { remindAt, ...rest } = body;
  if (remindAt === undefined) return rest;
  return { ...rest, remindAt: remindAt === null ? null : new Date(remindAt) };
}

export const listNotesQuery = z.object({
  q: z.string().max(QUERY_MAX_LENGTH).optional(),
  tag: z.string().max(QUERY_MAX_LENGTH).optional(),
  view: z.enum(['active', 'archived', 'reminders']).default('active'),
});
export type ListNotesQuery = z.infer<typeof listNotesQuery>;

/** Only a string: an id that is not a uuid is just a note that does not exist (404, not 400). */
export const noteIdParams = z.object({ id: z.string() });
export type NoteIdParams = z.infer<typeof noteIdParams>;
