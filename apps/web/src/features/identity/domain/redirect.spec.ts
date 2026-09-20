import { describe, expect, it } from 'vitest';
import { DEFAULT_REDIRECT, parseRedirect } from './redirect';

describe('parseRedirect', () => {
  it.each([
    ['/notes', '/notes'],
    ['/dev-tools', '/dev-tools'],
    ['/notes?tag=a&sort=b', '/notes?tag=a&sort=b'],
    ['/notes#top', '/notes#top'],
    ['/notes/123?x=1#y', '/notes/123?x=1#y'],
  ])('keeps the internal path %s', (input, expected) => {
    expect(parseRedirect(input)).toBe(expected);
  });

  it.each([
    ['a protocol-relative URL', '//evil.com'],
    ['a protocol-relative URL with a path', '//evil.com/notes'],
    ['an absolute URL', 'https://evil.com'],
    ['an absolute URL to this host name', 'http://localhost/notes'],
    ['a backslash host (browsers read it as //)', '/\\evil.com'],
    ['a tab hidden in the slashes', '/\t/evil.com'],
    ['a newline hidden in the slashes', '/\n/evil.com'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['a relative path', 'notes'],
    ['an empty string', ''],
    ['a lone slash-less dot', '.'],
  ])('falls back for %s', (_case, input) => {
    expect(parseRedirect(input)).toBe(DEFAULT_REDIRECT);
  });

  it.each([undefined, null, 42, {}, ['/notes']])('falls back for a non-string (%j)', (input) => {
    expect(parseRedirect(input)).toBe(DEFAULT_REDIRECT);
  });

  it.each(['/login', '/login?redirect=/notes', '/login/', '/login#x'])(
    'never redirects back to the login page (%s)',
    (input) => {
      expect(parseRedirect(input)).toBe(DEFAULT_REDIRECT);
    },
  );

  it('leaves an encoded slash alone: it stays inside the path', () => {
    expect(parseRedirect('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
  });
});
