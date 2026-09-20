import { describe, expect, it } from 'vitest';
import { WeakPasswordError } from './errors.js';
import { validatePassword } from './password-policy.js';

describe('validatePassword', () => {
  it('accepts the exact lower and upper limits', () => {
    expect(() => validatePassword('a'.repeat(12))).not.toThrow();
    expect(() => validatePassword('a'.repeat(128))).not.toThrow();
  });

  it('rejects passwords shorter than 12 characters', () => {
    expect(() => validatePassword('a'.repeat(11))).toThrow(WeakPasswordError);
    expect(() => validatePassword('')).toThrow(WeakPasswordError);
  });

  it('rejects passwords longer than 128 characters', () => {
    expect(() => validatePassword('a'.repeat(129))).toThrow(WeakPasswordError);
  });

  it('has no composition rules', () => {
    expect(() => validatePassword('aaaaaaaaaaaa')).not.toThrow();
    expect(() => validatePassword('            ')).not.toThrow();
  });
});
