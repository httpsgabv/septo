import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { NotesModule } from './modules/notes/notes.module.js';
import { RemindersModule } from './modules/reminders/reminders.module.js';
import { SharedModule } from './shared/shared.module.js';

@Module({ imports: [SharedModule, HealthModule, IdentityModule, NotesModule, RemindersModule] })
export class AppModule {}
