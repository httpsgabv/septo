/**
 * Base for business rule violations. Domain code states *what* went wrong (`kind`), never HTTP
 * status — the presentation layer maps kinds to status codes.
 */
export abstract class DomainError extends Error {
  /** Stable, machine-readable identifier exposed to clients, e.g. `NOTE_NOT_FOUND`. */
  abstract readonly code: string;
  abstract readonly kind:
    | 'not_found'
    | 'conflict'
    | 'invalid'
    | 'forbidden'
    | 'unauthenticated'
    | 'rate_limited';
  /** Only for `rate_limited`: becomes the `Retry-After` header. */
  readonly retryAfterSeconds?: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
