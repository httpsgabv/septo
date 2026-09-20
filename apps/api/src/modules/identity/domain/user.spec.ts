import { describe, expect, it } from 'vitest';
import { InvalidDisplayNameError } from './errors.js';
import { User } from './user.js';

const newUser = () => User.create({ username: 'gabriel', passwordHash: 'hash-1' });

describe('User', () => {
  it('starts with the username as display name and no sessions revoked', () => {
    const user = newUser();

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.displayName).toBe('gabriel');
    expect(user.tokenVersion).toBe(0);
    expect(user.lastLoginAt).toBeNull();
    expect(user.lastLoginIp).toBeNull();
  });

  it('changes the password hash and invalidates every issued token', () => {
    const user = newUser();

    user.changePassword('hash-2');

    expect(user.passwordHash).toBe('hash-2');
    expect(user.tokenVersion).toBe(1);
  });

  it('revokes sessions by bumping the token version', () => {
    const user = newUser();

    user.revokeSessions();
    user.revokeSessions();

    expect(user.tokenVersion).toBe(2);
    expect(user.passwordHash).toBe('hash-1');
  });

  it('records where and when the last login happened', () => {
    const user = newUser();
    const at = new Date('2026-09-20T10:00:00Z');

    user.recordLogin('203.0.113.7', at);

    expect(user.lastLoginAt).toEqual(at);
    expect(user.lastLoginIp).toBe('203.0.113.7');
    expect(user.tokenVersion).toBe(0);
  });

  it('renames without touching the display name or the sessions', () => {
    const user = newUser();

    user.rename('gabriel.b');

    expect(user.username).toBe('gabriel.b');
    expect(user.displayName).toBe('gabriel');
    expect(user.tokenVersion).toBe(0);
  });

  describe('updateProfile', () => {
    it('sets the display name', () => {
      const user = newUser();
      user.updateProfile({ displayName: 'Gabriel B.' });
      expect(user.displayName).toBe('Gabriel B.');
    });

    it('accepts 1 and 50 characters', () => {
      const user = newUser();
      expect(() => user.updateProfile({ displayName: 'a' })).not.toThrow();
      expect(() => user.updateProfile({ displayName: 'a'.repeat(50) })).not.toThrow();
    });

    it.each([
      ['empty', ''],
      ['too long', 'a'.repeat(51)],
      ['leading space', ' Gabriel'],
      ['trailing space', 'Gabriel '],
      ['only spaces', '   '],
    ])('rejects %s and keeps the current name', (_case, displayName) => {
      const user = newUser();
      expect(() => user.updateProfile({ displayName })).toThrow(InvalidDisplayNameError);
      expect(user.displayName).toBe('gabriel');
    });
  });
});
