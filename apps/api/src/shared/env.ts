import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3333),
  API_DOCS_ENABLED: z.stringbool().default(true),
  // Default keeps codegen/CI working without a .env; production always sets it.
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    .default('postgresql://septo:septo@localhost:5433/septo'),
});

export type Env = z.infer<typeof envSchema>;

/** DI token for the validated environment. */
export const ENV = Symbol('ENV');

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function loadEnv(): Env {
  // Local dev reads the monorepo root .env without overriding real env vars; containers inject them.
  const rootEnv = resolve(import.meta.dirname, '../../../../.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  return parseEnv(process.env);
}
