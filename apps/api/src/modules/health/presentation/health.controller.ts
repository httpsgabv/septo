import { Controller, Get } from '@nestjs/common';
import { ZodResponse } from '../../../shared/http/zod.decorators.js';
import { type HealthResponse, healthResponse } from './health.schemas.js';

@Controller('health')
export class HealthController {
  @Get()
  @ZodResponse(200, healthResponse)
  checkHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
