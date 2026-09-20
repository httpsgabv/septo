import type { CookieOptions, Response } from 'express';
import { SESSION_MAX_AGE_SECONDS } from '../domain/session.js';

export const SESSION_COOKIE = 'septo_session';

// Chrome and Firefox treat http://localhost as a secure context, so `Secure` also works in dev.
const attributes: CookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...attributes, maxAge: SESSION_MAX_AGE_SECONDS * 1000 });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, attributes);
}

/** Reads the session cookie from a raw `Cookie` header; a few lines instead of `cookie-parser`. */
export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  for (const part of cookieHeader?.split(';') ?? []) {
    const [name, ...value] = part.trim().split('=');
    if (name !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(value.join('=')) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
