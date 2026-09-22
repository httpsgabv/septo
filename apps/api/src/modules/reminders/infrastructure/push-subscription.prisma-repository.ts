import { Injectable } from '@nestjs/common';
import type { PushSubscription as PushSubscriptionRecord } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma.service.js';
import { PushSubscription } from '../domain/push-subscription.js';
import { PushSubscriptionRepository } from '../domain/push-subscription.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaPushSubscriptionRepository extends PushSubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async upsert(subscription: PushSubscription) {
    const mutable = {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      expirationTime: subscription.expirationTime,
    };
    const record = await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        id: subscription.id,
        endpoint: subscription.endpoint,
        createdAt: subscription.createdAt,
        ...mutable,
      },
      update: mutable,
    });
    return toDomain(record);
  }

  async findById(id: string) {
    if (!UUID.test(id)) return null;
    const record = await this.prisma.pushSubscription.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async listActiveAt(at: Date) {
    const records = await this.prisma.pushSubscription.findMany({
      where: { OR: [{ expirationTime: null }, { expirationTime: { gt: at } }] },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toDomain);
  }

  async delete(id: string) {
    if (!UUID.test(id)) return;
    await this.prisma.pushSubscription.deleteMany({ where: { id } });
  }
}

function toDomain(record: PushSubscriptionRecord) {
  return PushSubscription.restore(record);
}
