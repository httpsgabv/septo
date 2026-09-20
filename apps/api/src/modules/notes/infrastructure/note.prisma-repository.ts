import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma.service.js';
import type { Note } from '../domain/note.js';
import {
  type ListNotesCriteria,
  NOTES_LIST_LIMIT,
  NoteRepository,
} from '../domain/note.repository.js';
import { toDomain, toRecord } from './note.mapper.js';

// The id column is a Postgres uuid, which rejects any other string with an error (a 500) instead
// of "no rows". Anything that is not a uuid cannot be a stored note.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Prisma's `contains` becomes a LIKE without escaping the user's text, so `%`, `_` and `\` would act
// as wildcards. Postgres uses `\` as the default LIKE escape character.
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class PrismaNoteRepository extends NoteRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string) {
    if (!UUID.test(id)) return null;
    const record = await this.prisma.note.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async list({ query, tag, view }: ListNotesCriteria) {
    const where: Prisma.NoteWhereInput = {
      archivedAt: view === 'archived' ? { not: null } : null,
      ...(view === 'reminders' && { remindAt: { not: null } }),
      ...(query && { searchText: { contains: escapeLike(query) } }),
      ...(tag && { tags: { has: tag } }),
    };
    // Postgres sorts NULL first on DESC; `nulls: 'last'` keeps unpinned notes after the pinned ones.
    const orderBy: Prisma.NoteOrderByWithRelationInput[] =
      view === 'reminders'
        ? [{ remindAt: 'asc' }]
        : [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }];
    const records = await this.prisma.note.findMany({ where, orderBy, take: NOTES_LIST_LIMIT });
    return records.map(toDomain);
  }

  async listTags() {
    const rows = await this.prisma.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT unnest("tags") AS tag FROM "notes" WHERE "archivedAt" IS NULL ORDER BY tag`;
    return rows.map((row) => row.tag);
  }

  async save(note: Note) {
    const { id, ...data } = toRecord(note);
    await this.prisma.note.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  async delete(id: string) {
    if (!UUID.test(id)) return false;
    const { count } = await this.prisma.note.deleteMany({ where: { id } });
    return count > 0;
  }
}
