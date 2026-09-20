import { NoteNotFoundError } from '../domain/errors.js';
import type { Note } from '../domain/note.js';
import type { NoteRepository } from '../domain/note.repository.js';

export async function requireNote(notes: NoteRepository, id: string): Promise<Note> {
  const note = await notes.findById(id);
  if (!note) throw new NoteNotFoundError();
  return note;
}
