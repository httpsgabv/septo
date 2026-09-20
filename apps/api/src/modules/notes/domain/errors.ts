import { DomainError } from '../../../shared/domain-error.js';

export class NoteNotFoundError extends DomainError {
  readonly code = 'NOTE_NOT_FOUND';
  readonly kind = 'not_found';
  constructor() {
    super('Note not found');
  }
}

export class NoteEmptyError extends DomainError {
  readonly code = 'NOTE_EMPTY';
  readonly kind = 'invalid';
  constructor() {
    super('A note needs a title or a body');
  }
}

export class InvalidTagError extends DomainError {
  readonly code = 'INVALID_TAG';
  readonly kind = 'invalid';
  constructor() {
    super(
      'Tags must have 1 to 30 characters (letters, digits, dot, dash or underscore), up to 10 per note',
    );
  }
}
