import { Controller, Delete, Get, HttpCode, Put } from '@nestjs/common';
import { errorResponse } from '../../../shared/http/error-response.schema.js';
import { ZodBody, ZodParams, ZodResponse } from '../../../shared/http/zod.decorators.js';
import { DeletePushSubscriptionUseCase } from '../application/delete-push-subscription.use-case.js';
import { GetPushConfigUseCase } from '../application/get-push-config.use-case.js';
import { UpsertPushSubscriptionUseCase } from '../application/upsert-push-subscription.use-case.js';
import {
  type PushConfigResponse,
  type PushSubscriptionParams,
  type PushSubscriptionRequest,
  type PushSubscriptionResponse,
  pushConfigResponse,
  pushSubscriptionParams,
  pushSubscriptionRequest,
  pushSubscriptionResponse,
} from './push.schemas.js';

@Controller('push')
export class PushController {
  constructor(
    private readonly getPushConfig: GetPushConfigUseCase,
    private readonly upsertPushSubscription: UpsertPushSubscriptionUseCase,
    private readonly deletePushSubscription: DeletePushSubscriptionUseCase,
  ) {}

  @Get('config')
  @ZodResponse(200, pushConfigResponse)
  @ZodResponse(401, errorResponse)
  getConfig(): PushConfigResponse {
    return this.getPushConfig.execute();
  }

  @Put('subscriptions')
  @HttpCode(200)
  @ZodResponse(200, pushSubscriptionResponse)
  @ZodResponse(401, errorResponse)
  @ZodResponse(422, errorResponse)
  upsertSubscription(
    @ZodBody(pushSubscriptionRequest) body: PushSubscriptionRequest,
  ): Promise<PushSubscriptionResponse> {
    return this.upsertPushSubscription.execute(body);
  }

  @Delete('subscriptions/:id')
  @HttpCode(204)
  @ZodResponse(204)
  @ZodResponse(401, errorResponse)
  async deleteSubscription(
    @ZodParams(pushSubscriptionParams) { id }: PushSubscriptionParams,
  ): Promise<void> {
    await this.deletePushSubscription.execute(id);
  }
}
