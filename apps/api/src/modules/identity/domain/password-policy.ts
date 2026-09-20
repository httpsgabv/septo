import { WeakPasswordError } from './errors.js';

// NIST 800-63B: length is what matters; no composition rules.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Same rule for the API and the CLI. Counts UTF-16 units, like the zod `min`/`max` on the API. */
export function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new WeakPasswordError(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH);
  }
}
