import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// Lets codegen and CI boot the AppModule without a .env; production must set its own.
const DEV_JWT_SECRET = 'septo-dev-only-jwt-secret-never-use-in-production';

const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    API_PORT: z.coerce.number().int().positive().default(3333),
    API_DOCS_ENABLED: z.stringbool().default(true),
    // Default keeps codegen/CI working without a .env; production always sets it.
    DATABASE_URL: z
      .url({ protocol: /^postgres(ql)?$/ })
      .default('postgresql://septo:septo@localhost:5433/septo'),
    JWT_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && (env.JWT_SECRET?.length ?? 0) < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'is required in production and must have at least 32 characters',
      });
    }
  })
  .transform((env) => ({ ...env, JWT_SECRET: env.JWT_SECRET ?? DEV_JWT_SECRET }));

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
