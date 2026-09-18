import { Module } from '@nestjs/common';
import { CheckHealthUseCase } from './application/check-health.use-case.js';
import { DatabaseHealthCheck } from './domain/database-health-check.js';
import { PrismaDatabaseHealthCheck } from './infrastructure/prisma-database-health-check.js';
import { HealthController } from './presentation/health.controller.js';

@Module({
  controllers: [HealthController],
  providers: [
    CheckHealthUseCase,
    { provide: DatabaseHealthCheck, useClass: PrismaDatabaseHealthCheck },
  ],
})
export class HealthModule {}
