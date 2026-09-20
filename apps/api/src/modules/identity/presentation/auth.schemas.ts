import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '../domain/password-policy.js';

// Length caps only bound the work per request; the rules of a *new* password live in the domain.
export const loginRequest = z
  .object({
    username: z.string().min(1).max(50),
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  })
  .meta({ id: 'LoginRequest' });
export type LoginRequest = z.infer<typeof loginRequest>;
