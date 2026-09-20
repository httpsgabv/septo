import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';

const hasher = new Argon2PasswordHasher();

describe('Argon2PasswordHasher', () => {
  it('hashes to a PHC string with the OWASP argon2id parameters', async () => {
    const hash = await hasher.hash('correct horse battery staple');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
  });

  it('verifies the right password', async () => {
    const hash = await hasher.hash('correct horse battery staple');

    expect(await hasher.verify('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hasher.hash('correct horse battery staple');

    expect(await hasher.verify('correct horse battery stapl', hash)).toBe(false);
    expect(await hasher.verify('', hash)).toBe(false);
  });

  it('salts: the same password hashes differently each time, and both verify', async () => {
    const [a, b] = await Promise.all([
      hasher.hash('same-password-123'),
      hasher.hash('same-password-123'),
    ]);

    expect(a).not.toBe(b);
    expect(await hasher.verify('same-password-123', a)).toBe(true);
    expect(await hasher.verify('same-password-123', b)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['plain text', 'not-a-hash'],
    ['another algorithm', '$argon2i$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNo'],
    ['missing hash part', '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0'],
    ['non numeric params', '$argon2id$v=19$m=x,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNo'],
    ['zero params', '$argon2id$v=19$m=0,t=0,p=0$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNo'],
  ])('returns false, not an error, for a malformed hash (%s)', async (_case, hash) => {
    expect(await hasher.verify('correct horse battery staple', hash)).toBe(false);
  });
});
