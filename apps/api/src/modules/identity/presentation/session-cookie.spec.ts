import { describe, expect, it } from 'vitest';
import { readSessionCookie } from './session-cookie.js';

describe('readSessionCookie', () => {
  it('reads the session cookie among others', () => {
    expect(readSessionCookie('theme=dark; septo_session=abc.def.ghi; lang=pt')).toBe('abc.def.ghi');
  });

  it('reads it when it is the only cookie, with or without spaces', () => {
    expect(readSessionCookie('septo_session=abc')).toBe('abc');
    expect(readSessionCookie('  septo_session=abc  ')).toBe('abc');
  });

  it('decodes URL-encoded values', () => {
    expect(readSessionCookie('septo_session=a%2Bb')).toBe('a+b');
  });

  it('does not match cookies that merely end with the name', () => {
    expect(readSessionCookie('not_septo_session=evil')).toBeUndefined();
  });

  it('returns undefined when absent, empty or malformed', () => {
    expect(readSessionCookie(undefined)).toBeUndefined();
    expect(readSessionCookie('')).toBeUndefined();
    expect(readSessionCookie('theme=dark')).toBeUndefined();
    expect(readSessionCookie('septo_session=')).toBeUndefined();
    expect(readSessionCookie('septo_session=%E0%A4%A')).toBeUndefined();
  });
});
