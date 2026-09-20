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
