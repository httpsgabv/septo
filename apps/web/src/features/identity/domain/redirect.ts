export const DEFAULT_REDIRECT = '/notes';

// Only used to resolve the value the way a browser would; it is never navigated to.
const ORIGIN = 'http://septo.invalid';

/**
 * Validates the `?redirect=` of the login page: only paths inside this app survive, everything else
 * (other hosts, `//host`, `javascript:`, backslash and whitespace tricks) becomes `/notes`.
 * Resolving with `URL` applies the same normalization a browser does, so what we check is what it opens.
 */
export function parseRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return DEFAULT_REDIRECT;

  let url: URL;
  try {
    url = new URL(value, ORIGIN);
  } catch {
    return DEFAULT_REDIRECT;
  }
  if (url.origin !== ORIGIN) return DEFAULT_REDIRECT;
  // Landing on /login after logging in would just bounce back.
  if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return DEFAULT_REDIRECT;

  return `${url.pathname}${url.search}${url.hash}`;
}
