import { describe, expect, it } from 'vitest';
import { InvalidUsernameError } from './errors.js';
import { validateUsername } from './username.js';

describe('validateUsername', () => {
  it.each(['gabriel', 'g', 'gabriel.bauer', 'gabriel_b-9', 'a'.repeat(50)])(
    'accepts %s',
    (name) => {
      expect(() => validateUsername(name)).not.toThrow();
    },
  );

  it.each([
    ['empty', ''],
    ['with spaces', 'gabriel bauer'],
    ['padded', ' gabriel'],
    ['with @', 'gabriel@x.com'],
    ['too long', 'a'.repeat(51)],
  ])('rejects %s', (_case, name) => {
    expect(() => validateUsername(name)).toThrow(InvalidUsernameError);
  });
});
