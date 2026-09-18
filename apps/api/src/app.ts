import type { NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

/** Builds the configured app without listening — shared by main, tests and the OpenAPI generator. */
export async function createApp(options: NestApplicationOptions = {}) {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'], ...options });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  return app;
}
