import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../../shared/env.js';
import { PrismaService } from '../../../shared/prisma.service.js';
import { PrismaReminderSource } from './prisma-reminder-source.js';

const prisma = new PrismaService(loadEnv());
const source = new PrismaReminderSource(prisma);
const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 8, 20, hour, minute));

async function addNote(
  title: string,
  remindAt: Date | null,
  overrides: { archivedAt?: Date; updatedAt?: Date } = {},
) {
  return prisma.note.create({
    data: {
      id: randomUUID(),
      title,
      body: '',
      searchText: `${title}\n`,
      tags: [],
      archivedAt: overrides.archivedAt,
      remindAt,
      createdAt: at(8),
      updatedAt: overrides.updatedAt ?? at(9),
    },
  });
}

describe('PrismaReminderSource', () => {
  beforeEach(() => prisma.note.deleteMany());
  afterAll(() => prisma.$disconnect());

  it('lists eligible due notes inside the half-open window, ordered and limited', async () => {
    await addNote('at the lower boundary', at(10));
    const first = await addNote('first', at(10, 30));
    const second = await addNote('second', at(11));
    await addNote('archived', at(11, 30), { archivedAt: at(9, 30) });
    await addNote('edited when due', at(11, 45), { updatedAt: at(11, 45) });
    const upper = await addNote('at the upper boundary', at(12));
    await addNote('after the window', at(12, 1));
    await addNote('without reminder', null);

    expect(await source.listDue({ after: at(10), through: at(12), limit: 2 })).toEqual([
      {
        id: first.id,
        title: 'first',
        remindAt: at(10, 30),
        updatedAt: at(9),
      },
      { id: second.id, title: 'second', remindAt: at(11), updatedAt: at(9) },
    ]);

    expect(
      (await source.listDue({ after: at(10), through: at(12), limit: 10 })).map(({ id }) => id),
    ).toEqual([first.id, second.id, upper.id]);
  });

  it('finds a current reminder by the same instant', async () => {
    const note = await addNote('current', at(12));

    await expect(source.findCurrent(note.id, new Date(at(12).toISOString()))).resolves.toEqual({
      id: note.id,
      title: 'current',
      remindAt: at(12),
      updatedAt: at(9),
    });
  });

  it('returns null for invalid, missing, archived, rescheduled, or stale reminders', async () => {
    const archived = await addNote('archived', at(12), { archivedAt: at(10) });
    const rescheduled = await addNote('rescheduled', at(13));
    const editedWhenDue = await addNote('edited', at(12), { updatedAt: at(12) });
    const editedAfterDue = await addNote('edited later', at(12), { updatedAt: at(12, 1) });

    await expect(source.findCurrent('not-a-uuid', at(12))).resolves.toBeNull();
    await expect(
      source.findCurrent('7f1c2b3a-0000-4000-8000-000000000000', at(12)),
    ).resolves.toBeNull();
    await expect(source.findCurrent(archived.id, at(12))).resolves.toBeNull();
    await expect(source.findCurrent(rescheduled.id, at(12))).resolves.toBeNull();
    await expect(source.findCurrent(editedWhenDue.id, at(12))).resolves.toBeNull();
    await expect(source.findCurrent(editedAfterDue.id, at(12))).resolves.toBeNull();
  });
});
