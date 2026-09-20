import { InvalidUsernameError } from './errors.js';

/** The username is only an identifier, so no spaces or `@`: it must survive being typed on a phone. */
export function validateUsername(username: string): void {
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(username)) throw new InvalidUsernameError();
}
