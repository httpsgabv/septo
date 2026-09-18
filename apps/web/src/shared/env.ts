import { z } from 'zod';

// Server-only variables (SSR and Vite dev server). Never import this from client code.
const serverEnvSchema = z.object({
  WEB_PORT: z.coerce.number().int().positive().default(5173),
  API_INTERNAL_URL: z.url().default('http://localhost:3333'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
