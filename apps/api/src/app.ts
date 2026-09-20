import type { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './shared/http/api-exception.filter.js';
import { requireJsonBody } from './shared/http/require-json-body.js';

/** Builds the configured app without listening — shared by main, tests and the OpenAPI generator. */
export async function createApp(options: NestApplicationOptions = {}) {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'], ...options });
  return configureApp(app);
}

/** App-wide wiring; tests that override providers call this on their own testing app. */
export function configureApp<T extends INestApplication>(app: T): T {
  // Caddy is the only hop in production: `req.ip` becomes the real client (rate limit, last login).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(requireJsonBody);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  return app;
}
