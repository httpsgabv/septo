import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { SharedModule } from './shared/shared.module.js';

@Module({ imports: [SharedModule, HealthModule, IdentityModule] })
export class AppModule {}
