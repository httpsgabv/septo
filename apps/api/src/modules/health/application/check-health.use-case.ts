import { Injectable } from '@nestjs/common';
import { DatabaseHealthCheck } from '../domain/database-health-check.js';
import type { HealthReport } from '../domain/health-report.js';

@Injectable()
export class CheckHealthUseCase {
  constructor(private readonly database: DatabaseHealthCheck) {}

  async execute(): Promise<HealthReport> {
    const up = await this.database.isUp();
    return up ? { status: 'ok', db: 'up' } : { status: 'degraded', db: 'down' };
  }
}
