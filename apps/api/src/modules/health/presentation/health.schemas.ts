import { z } from 'zod';

export const healthResponse = z.object({ status: z.literal('ok') }).meta({ id: 'HealthResponse' });
export type HealthResponse = z.infer<typeof healthResponse>;
