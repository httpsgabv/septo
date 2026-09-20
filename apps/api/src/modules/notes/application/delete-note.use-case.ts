import { Injectable } from '@nestjs/common';
import { NoteNotFoundError } from '../domain/errors.js';
import { NoteRepository } from '../domain/note.repository.js';

@Injectable()
export class DeleteNoteUseCase {
  constructor(private readonly notes: NoteRepository) {}

  async execute(id: string): Promise<void> {
    if (!(await this.notes.delete(id))) throw new NoteNotFoundError();
  }
}
