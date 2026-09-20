import { Module } from '@nestjs/common';
import { CreateNoteUseCase } from './application/create-note.use-case.js';
import { DeleteNoteUseCase } from './application/delete-note.use-case.js';
import { GetNoteUseCase } from './application/get-note.use-case.js';
import { ListNotesUseCase } from './application/list-notes.use-case.js';
import { ListTagsUseCase } from './application/list-tags.use-case.js';
import { SetNoteArchivedUseCase } from './application/set-note-archived.use-case.js';
import { SetNotePinnedUseCase } from './application/set-note-pinned.use-case.js';
import { UpdateNoteUseCase } from './application/update-note.use-case.js';
import { NoteRepository } from './domain/note.repository.js';
import { PrismaNoteRepository } from './infrastructure/note.prisma-repository.js';

@Module({
  providers: [
    CreateNoteUseCase,
    GetNoteUseCase,
    ListNotesUseCase,
    UpdateNoteUseCase,
    SetNotePinnedUseCase,
    SetNoteArchivedUseCase,
    DeleteNoteUseCase,
    ListTagsUseCase,
    { provide: NoteRepository, useClass: PrismaNoteRepository },
  ],
})
export class NotesModule {}
