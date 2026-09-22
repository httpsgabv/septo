import { Injectable } from '@nestjs/common';
import type { ReminderDelivery as ReminderDeliveryRecord } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma.service.js';
import { ReminderDelivery } from '../domain/reminder-delivery.js';
import { ReminderDeliveryRepository } from '../domain/reminder-delivery.repository.js';

@Injectable()
export class PrismaReminderDeliveryRepository extends ReminderDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async materialize(deliveries: readonly ReminderDelivery[]) {
    if (deliveries.length === 0) return;
    await this.prisma.reminderDelivery.createMany({
      data: deliveries.map(toRecord),
      skipDuplicates: true,
    });
  }

  async listReady(now: Date, limit: number) {
    const records = await this.prisma.reminderDelivery.findMany({
      where: {
        status: { in: ['pending', 'retry'] },
        nextAttemptAt: { lte: now },
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { scheduledFor: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });
    return records.map(toDomain);
  }

  async save(delivery: ReminderDelivery) {
    await this.prisma.reminderDelivery.update({
      where: { id: delivery.id },
      data: {
        status: delivery.status,
        attempts: delivery.attempts,
        nextAttemptAt: delivery.nextAttemptAt,
        lastStatusCode: delivery.lastStatusCode,
        sentAt: delivery.sentAt,
        updatedAt: delivery.updatedAt,
      },
    });
  }
}

function toRecord(delivery: ReminderDelivery) {
  return {
    id: delivery.id,
    noteId: delivery.noteId,
    scheduledFor: delivery.scheduledFor,
    subscriptionId: delivery.subscriptionId,
    status: delivery.status,
    attempts: delivery.attempts,
    nextAttemptAt: delivery.nextAttemptAt,
    lastStatusCode: delivery.lastStatusCode,
    sentAt: delivery.sentAt,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
  };
}

function toDomain(record: ReminderDeliveryRecord) {
  return ReminderDelivery.restore(record);
}
