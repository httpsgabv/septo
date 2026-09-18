import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

/** Builds the configured app without listening — shared by main, tests and the OpenAPI script. */
export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  return app;
}
