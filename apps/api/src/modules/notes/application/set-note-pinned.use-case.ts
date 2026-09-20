import { Injectable } from '@nestjs/common';
import type { Note } from '../domain/note.js';
import { NoteRepository } from '../domain/note.repository.js';
import { requireNote } from './require-note.js';

/** One use case for `POST` and `DELETE` on `:id/pin`. */
@Injectable()
export class SetNotePinnedUseCase {
  /** Replaced in tests to fix the clock. */
  now = () => new Date();

  constructor(private readonly notes: NoteRepository) {}

  async execute(input: { id: string; pinned: boolean }): Promise<Note> {
    const note = await requireNote(this.notes, input.id);
    note.setPinned(input.pinned, this.now());
    await this.notes.save(note);
    return note;
  }
}
