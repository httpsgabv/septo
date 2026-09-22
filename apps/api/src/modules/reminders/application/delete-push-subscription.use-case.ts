import { Injectable } from '@nestjs/common';
import { PushSubscriptionRepository } from '../domain/push-subscription.repository.js';

@Injectable()
export class DeletePushSubscriptionUseCase {
  constructor(private readonly subscriptions: PushSubscriptionRepository) {}

  execute(id: string) {
    return this.subscriptions.delete(id);
  }
}
