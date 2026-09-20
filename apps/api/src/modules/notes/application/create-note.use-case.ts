import { Injectable } from '@nestjs/common';
import { Note, type NoteInput } from '../domain/note.js';
import { NoteRepository } from '../domain/note.repository.js';

@Injectable()
export class CreateNoteUseCase {
  /** Replaced in tests to fix the clock. */
  now = () => new Date();

  constructor(private readonly notes: NoteRepository) {}

  async execute(input: NoteInput): Promise<Note> {
    const note = Note.create(input, this.now());
    await this.notes.save(note);
    return note;
  }
}
