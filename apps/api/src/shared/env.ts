import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// Lets codegen and CI boot the AppModule without a .env; production must set its own.
const DEV_JWT_SECRET = 'septo-dev-only-jwt-secret-never-use-in-production';
const DEV_VAPID_PUBLIC_KEY =
  'BGtkbcjrO12YMoDuq2sCQeHlu47uPx3SHTgFKZFYiBW8Qr0D9vgyZSZPdw6_4ZFEI9Snk1VEAj2qTYI1I1YxBXE';
const DEV_VAPID_PRIVATE_KEY = 'I0_d0vnesxbBSUmlDdOKibGo6vEXRO-Vu88QlSlm5j0';
const DEV_VAPID_SUBJECT = 'mailto:dev@septo.local';

const vapidPublicKey = z
  .string()
  .regex(/^[A-Za-z0-9_-]{87}$/, 'must be an 87-character base64url key');
const vapidPrivateKey = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'must be a 43-character base64url key');
const vapidSubject = z.union([
  z.string().regex(/^mailto:[^@\s]+@[^@\s]+$/, 'must be a mailto: address or https URL'),
  z.url({ protocol: /^https$/ }),
]);

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
    VAPID_PUBLIC_KEY: vapidPublicKey.optional(),
    VAPID_PRIVATE_KEY: vapidPrivateKey.optional(),
    VAPID_SUBJECT: vapidSubject.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    if ((env.JWT_SECRET?.length ?? 0) < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'is required in production and must have at least 32 characters',
      });
    }

    for (const key of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'is required in production',
        });
      }
    }

    if (
      env.VAPID_PUBLIC_KEY === DEV_VAPID_PUBLIC_KEY ||
      env.VAPID_PRIVATE_KEY === DEV_VAPID_PRIVATE_KEY
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['VAPID_PRIVATE_KEY'],
        message: 'production cannot use the fixed development VAPID keys',
      });
    }
  })
  .transform((env) => ({
    ...env,
    JWT_SECRET: env.JWT_SECRET ?? DEV_JWT_SECRET,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY ?? DEV_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY ?? DEV_VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: env.VAPID_SUBJECT ?? DEV_VAPID_SUBJECT,
  }));

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
