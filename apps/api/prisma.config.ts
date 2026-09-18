import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Local dev reads the monorepo root .env; containers inject variables directly.
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Fallback lets `prisma generate` run without a .env (e.g. CI); migrations use the real URL.
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://septo:septo@localhost:5433/septo' },
});
