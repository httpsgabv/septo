/** Brute force guard, keyed by client. */
export abstract class LoginAttempts {
  /** Seconds until the IP may try again, or `0` when it is not blocked. */
  abstract retryAfterSeconds(ip: string): number;
  /**
   * Counts a login attempt as a failure. Called *before* the slow password check, so parallel guesses
   * cannot slip past the limit while earlier ones are still being verified; `reset` undoes it on success.
   */
  abstract recordAttempt(ip: string): void;
  abstract reset(ip: string): void;
}
