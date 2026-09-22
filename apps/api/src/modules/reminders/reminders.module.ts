import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module.js';
import { DispatchDueRemindersUseCase } from './application/dispatch-due-reminders.use-case.js';
import { PushSender } from './domain/push-sender.js';
import { PushSubscriptionRepository } from './domain/push-subscription.repository.js';
import { ReminderDeliveryRepository } from './domain/reminder-delivery.repository.js';
import { PrismaPushSubscriptionRepository } from './infrastructure/push-subscription.prisma-repository.js';
import { PrismaReminderDeliveryRepository } from './infrastructure/reminder-delivery.prisma-repository.js';
import { ReminderSchedulerService } from './infrastructure/reminder-scheduler.service.js';
import { WebPushSender } from './infrastructure/web-push.sender.js';

@Module({
  imports: [NotesModule],
  providers: [
    DispatchDueRemindersUseCase,
    ReminderSchedulerService,
    { provide: PushSubscriptionRepository, useClass: PrismaPushSubscriptionRepository },
    { provide: ReminderDeliveryRepository, useClass: PrismaReminderDeliveryRepository },
    { provide: PushSender, useClass: WebPushSender },
  ],
})
export class RemindersModule {}
