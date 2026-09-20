import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../domain/password-policy.js';
import { DISPLAY_NAME_MAX_LENGTH, type User } from '../domain/user.js';

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

export const updateMeRequest = z
  .object({
    displayName: z
      .string()
      .min(1)
      .max(DISPLAY_NAME_MAX_LENGTH)
      // No leading or trailing whitespace: a single non-space char, or non-space at both ends.
      .regex(/^(?:\S|\S[\s\S]*\S)$/),
  })
  .meta({ id: 'UpdateMeRequest' });
export type UpdateMeRequest = z.infer<typeof updateMeRequest>;

export const changePasswordRequest = z
  .object({
    // Only a cap on the current one: it is checked against the stored hash, not against the policy.
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  })
  .meta({ id: 'ChangePasswordRequest' });
export type ChangePasswordRequest = z.infer<typeof changePasswordRequest>;
