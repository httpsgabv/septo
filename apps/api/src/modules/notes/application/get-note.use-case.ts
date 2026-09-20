import { Injectable } from '@nestjs/common';
import type { Note } from '../domain/note.js';
import { NoteRepository } from '../domain/note.repository.js';
import { requireNote } from './require-note.js';

@Injectable()
export class GetNoteUseCase {
  constructor(private readonly notes: NoteRepository) {}

  execute(id: string): Promise<Note> {
    return requireNote(this.notes, id);
  }
}
