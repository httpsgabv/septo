import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma.service.js';
import { type ReminderCandidate, ReminderSource } from '../domain/reminder-source.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const candidateFields = {
  id: true,
  title: true,
  remindAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PrismaReminderSource extends ReminderSource {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listDue(input: { after: Date; through: Date; limit: number }) {
    const records = await this.prisma.note.findMany({
      where: {
        archivedAt: null,
        remindAt: { gt: input.after, lte: input.through },
        updatedAt: { lt: this.prisma.note.fields.remindAt },
      },
      select: candidateFields,
      orderBy: { remindAt: 'asc' },
      take: input.limit,
    });
    return records.map(toCandidate);
  }

  async findCurrent(id: string, scheduledFor: Date) {
    if (!UUID.test(id)) return null;
    const record = await this.prisma.note.findFirst({
      where: {
        id,
        archivedAt: null,
        remindAt: scheduledFor,
        updatedAt: { lt: this.prisma.note.fields.remindAt },
      },
      select: candidateFields,
    });
    return record ? toCandidate(record) : null;
  }
}

function toCandidate(record: {
  id: string;
  title: string;
  remindAt: Date | null;
  updatedAt: Date;
}): ReminderCandidate {
  if (!record.remindAt) throw new Error('Reminder query returned a note without remindAt');
  return { ...record, remindAt: record.remindAt };
}
