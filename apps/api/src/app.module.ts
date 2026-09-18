import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { SharedModule } from './shared/shared.module.js';

@Module({ imports: [SharedModule, HealthModule] })
export class AppModule {}
