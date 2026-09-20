import { Injectable } from '@nestjs/common';
import { NoteRepository } from '../domain/note.repository.js';

@Injectable()
export class ListTagsUseCase {
  constructor(private readonly notes: NoteRepository) {}

  /** Distinct tags of non-archived notes, alphabetical. */
  execute(): Promise<string[]> {
    return this.notes.listTags();
  }
}
