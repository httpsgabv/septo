import { z } from 'zod';

/** Body of every non-2xx response. */
export const errorResponse = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  })
  .meta({ id: 'ErrorResponse' });

export type ErrorResponse = z.infer<typeof errorResponse>;
