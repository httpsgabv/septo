/** Brute force guard, keyed by client IP. */
export abstract class LoginAttempts {
  /** Seconds until the IP may try again, or `0` when it is not blocked. */
  abstract retryAfterSeconds(ip: string): number;
  abstract recordFailure(ip: string): void;
  abstract reset(ip: string): void;
}
