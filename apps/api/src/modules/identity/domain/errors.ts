import { DomainError } from '../../../shared/domain-error.js';

export class WeakPasswordError extends DomainError {
  readonly code = 'WEAK_PASSWORD';
  readonly kind = 'invalid';
  constructor(min: number, max: number) {
    super(`Password must have between ${min} and ${max} characters`);
  }
}

export class InvalidDisplayNameError extends DomainError {
  readonly code = 'INVALID_DISPLAY_NAME';
  readonly kind = 'invalid';
  constructor() {
    super('Display name must have 1 to 50 characters, without leading or trailing spaces');
  }
}

export class InvalidCurrentPasswordError extends DomainError {
  readonly code = 'INVALID_CURRENT_PASSWORD';
  readonly kind = 'invalid';
  constructor() {
    super('Current password is incorrect');
  }
}

export class InvalidUsernameError extends DomainError {
  readonly code = 'INVALID_USERNAME';
  readonly kind = 'invalid';
  constructor() {
    super('Username must have 1 to 50 characters: letters, digits, dot, dash or underscore');
  }
}

export class UnauthenticatedError extends DomainError {
  readonly code = 'UNAUTHENTICATED';
  readonly kind = 'unauthenticated';
  constructor() {
    super('Authentication required');
  }
}

/** Deliberately the same for an unknown username and a wrong password. */
export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';
  readonly kind = 'unauthenticated';
  constructor() {
    super('Invalid username or password');
  }
}

export class TooManyAttemptsError extends DomainError {
  readonly code = 'TOO_MANY_ATTEMPTS';
  readonly kind = 'rate_limited';
  constructor(readonly retryAfterSeconds: number) {
    super('Too many failed attempts, try again later');
  }
}
