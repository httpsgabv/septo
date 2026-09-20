import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ZodResponse } from '../../../shared/http/zod.decorators.js';
import { Public } from '../../identity/presentation/public.decorator.js';
import { CheckHealthUseCase } from '../application/check-health.use-case.js';
import { type HealthResponse, healthResponse } from './health.schemas.js';

@Controller('health')
export class HealthController {
  constructor(private readonly checkHealth: CheckHealthUseCase) {}

  // Public: Caddy, Docker and uptime checks poll it without a session.
  @Public()
  @Get()
  @ZodResponse(200, healthResponse)
  @ZodResponse(503, healthResponse)
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const report = await this.checkHealth.execute();
    if (report.status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
