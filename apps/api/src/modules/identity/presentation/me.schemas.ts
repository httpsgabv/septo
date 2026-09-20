import { z } from 'zod';
import type { User } from '../domain/user.js';

export const meResponse = z
  .object({
    id: z.uuid(),
    username: z.string(),
    displayName: z.string(),
    lastLoginAt: z.iso.datetime().nullable(),
    lastLoginIp: z.string().nullable(),
  })
  .meta({ id: 'Me' });
export type MeResponse = z.infer<typeof meResponse>;

/** Only what the client may see: never the hash or the tokenVersion. */
export function toMeResponse(user: User): MeResponse {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    lastLoginIp: user.lastLoginIp,
  };
}
