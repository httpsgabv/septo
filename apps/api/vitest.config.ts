import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Integration tests use the septo_test database (created by docker/postgres/init) on the same server.
const testDatabaseUrl = new URL(
  process.env.DATABASE_URL ?? 'postgresql://septo:septo@localhost:5433/septo',
);
testDatabaseUrl.pathname = '/septo_test';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    env: { DATABASE_URL: testDatabaseUrl.toString() },
  },
  // SWC instead of esbuild: esbuild does not emit decorator metadata, which Nest DI relies on
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
