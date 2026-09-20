import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';

/** A fresh `septo_test` (e.g. after `docker compose down -v`) has no tables until migrations run. */
export default function applyMigrations(project: TestProject) {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: project.config.env.DATABASE_URL },
    stdio: 'pipe',
  });
}
