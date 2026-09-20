import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { errorResponse } from '../../../shared/http/error-response.schema.js';
import { ZodBody, ZodParams, ZodQuery, ZodResponse } from '../../../shared/http/zod.decorators.js';
import { CreateNoteUseCase } from '../application/create-note.use-case.js';
import { DeleteNoteUseCase } from '../application/delete-note.use-case.js';
import { GetNoteUseCase } from '../application/get-note.use-case.js';
import { ListNotesUseCase } from '../application/list-notes.use-case.js';
import { SetNoteArchivedUseCase } from '../application/set-note-archived.use-case.js';
import { SetNotePinnedUseCase } from '../application/set-note-pinned.use-case.js';
import { UpdateNoteUseCase } from '../application/update-note.use-case.js';
import {
  type CreateNoteRequest,
  createNoteRequest,
  type ListNotesQuery,
  listNotesQuery,
  type NoteIdParams,
  type NoteResponse,
  type NoteSummaryResponse,
  noteIdParams,
  noteResponse,
  noteSummaryResponse,
  toNoteInput,
  toNoteResponse,
  toNoteSummaryResponse,
  type UpdateNoteRequest,
  updateNoteRequest,
} from './notes.schemas.js';

// Every route here is protected by the global AuthGuard: nothing in this module is public.
@Controller('notes')
export class NotesController {
  constructor(
    private readonly listNotes: ListNotesUseCase,
    private readonly createNote: CreateNoteUseCase,
    private readonly getNote: GetNoteUseCase,
    private readonly updateNote: UpdateNoteUseCase,
    private readonly setPinned: SetNotePinnedUseCase,
    private readonly setArchived: SetNoteArchivedUseCase,
    private readonly deleteNote: DeleteNoteUseCase,
  ) {}

  @Get()
  @ZodResponse(200, noteSummaryResponse.array())
  @ZodResponse(401, errorResponse)
  async list(@ZodQuery(listNotesQuery) query: ListNotesQuery): Promise<NoteSummaryResponse[]> {
    return (await this.listNotes.execute(query)).map(toNoteSummaryResponse);
  }

  @Post()
  @ZodResponse(201, noteResponse)
  @ZodResponse(401, errorResponse)
  @ZodResponse(422, errorResponse)
  async create(@ZodBody(createNoteRequest) body: CreateNoteRequest): Promise<NoteResponse> {
    return toNoteResponse(await this.createNote.execute(toNoteInput(body)));
  }

  @Get(':id')
  @ZodResponse(200, noteResponse)
  @ZodResponse(401, errorResponse)
  @ZodResponse(404, errorResponse)
  async get(@ZodParams(noteIdParams) { id }: NoteIdParams): Promise<NoteResponse> {
    return toNoteResponse(await this.getNote.execute(id));
  }

  @Patch(':id')
  @ZodResponse(200, noteResponse)
  @ZodResponse(401, errorResponse)
  @ZodResponse(404, errorResponse)
  @ZodResponse(422, errorResponse)
  async update(
    @ZodParams(noteIdParams) { id }: NoteIdParams,
    @ZodBody(updateNoteRequest) body: UpdateNoteRequest,
  ): Promise<NoteResponse> {
    return toNoteResponse(await this.updateNote.execute({ id, ...toNoteInput(body) }));
  }

  @Post(':id/pin')
  @HttpCode(200)
  @ZodResponse(200, noteResponse)
  @ZodResponse(401, errorResponse)
  @ZodResponse(404, errorResponse)
  async pin(@ZodParams(noteIdParams) { id }: NoteIdParams): Promise<NoteResponse> {
    return toNoteResponse(await this.setPinned.execute({ id, pinned: true }));
  }

  @Delete(':id/pin')
  @ZodResponse(200, noteResponse)
  @ZodResponse(401, errorResponse)
  @ZodResponse(404, errorResponse)
  async unpin(@ZodParams(noteIdParams) { id }: NoteIdParams): Promise<NoteResponse> {
    return toNoteResponse(await this.setPinned.execute({ id, pinned: false }));
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ZodResponse(200, noteResponse)
  @ZodResponse(401, errorResponse)
  @ZodResponse(404, errorResponse)
  async archive(@ZodParams(noteIdParams) { id }: NoteIdParams): Promise<NoteResponse> {
    return toNoteResponse(await this.setArchived.execute({ id, archived: true }));
  }

  @Delete(':id/archive')
  @ZodResponse(200, noteResponse)
  @ZodResponse(401, errorResponse)
  @ZodResponse(404, errorResponse)
  async unarchive(@ZodParams(noteIdParams) { id }: NoteIdParams): Promise<NoteResponse> {
    return toNoteResponse(await this.setArchived.execute({ id, archived: false }));
  }

  @Delete(':id')
  @HttpCode(204)
  @ZodResponse(204)
  @ZodResponse(401, errorResponse)
  @ZodResponse(404, errorResponse)
  async delete(@ZodParams(noteIdParams) { id }: NoteIdParams): Promise<void> {
    await this.deleteNote.execute(id);
  }
}
