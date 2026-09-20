import { z } from 'zod';
import type { NotesListParams } from '../../../shared/api/generated/models';

export const NOTES_VIEWS = ['active', 'archived', 'reminders'] as const;
export type NotesView = (typeof NOTES_VIEWS)[number];

const MAX_LENGTH = 200;

/** Text from the URL, or nothing: the router JSON-parses `?q=123` into a number. */
const text = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().max(MAX_LENGTH))
  .refine((value) => value.trim() !== '')
  .optional()
  .catch(undefined);

/**
 * `?q=`, `?tag=` and `?view=` of `/notes`. Every field is optional and an invalid value falls back
 * to "not set", so a hand-edited URL never breaks the page. An absent `view` means `active`.
 */
export const notesSearchSchema = z.object({
  q: text,
  tag: text,
  view: z.enum(NOTES_VIEWS).optional().catch(undefined),
});
export type NotesSearch = z.infer<typeof notesSearchSchema>;

/** The API defaults to `active`, so it is left out; that also keeps the query key stable. */
export function toListParams({ q, tag, view }: NotesSearch): NotesListParams {
  return {
    ...(q && { q }),
    ...(tag && { tag }),
    ...(view && view !== 'active' && { view }),
  };
}
