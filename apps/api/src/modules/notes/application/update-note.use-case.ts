import { Injectable } from '@nestjs/common';
import type { Note, NotePatch } from '../domain/note.js';
import { NoteRepository } from '../domain/note.repository.js';
import { requireNote } from './require-note.js';

@Injectable()
export class UpdateNoteUseCase {
  /** Replaced in tests to fix the clock. */
  now = () => new Date();

  constructor(private readonly notes: NoteRepository) {}

  /** Partial patch: an absent field stays, `remindAt: null` clears the reminder. */
  async execute(input: { id: string } & NotePatch): Promise<Note> {
    const { id, ...patch } = input;
    const note = await requireNote(this.notes, id);
    note.edit(patch, this.now());
    await this.notes.save(note);
    return note;
  }
}
