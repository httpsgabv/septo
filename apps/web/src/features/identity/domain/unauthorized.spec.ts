import { describe, expect, it } from 'vitest';
import { shouldRedirectOnUnauthorized } from './unauthorized';

describe('shouldRedirectOnUnauthorized', () => {
  it('redirects when an ordinary call fails with 401 inside the app', () => {
    expect(shouldRedirectOnUnauthorized({ method: 'patch', url: '/api/me' }, '/settings')).toBe(
      true,
    );
    expect(shouldRedirectOnUnauthorized({ method: 'get', url: '/api/health' }, '/notes')).toBe(
      true,
    );
  });

  it('never redirects from the login page: it is where the user already is', () => {
    expect(shouldRedirectOnUnauthorized({ method: 'get', url: '/api/me' }, '/login')).toBe(false);
    expect(shouldRedirectOnUnauthorized({ method: 'post', url: '/api/x' }, '/login')).toBe(false);
  });

  it('ignores the 401 of a failed login: that is a wrong password, not an expired session', () => {
    expect(
      shouldRedirectOnUnauthorized({ method: 'post', url: '/api/auth/login' }, '/settings'),
    ).toBe(false);
  });

  it('leaves the session probe to the route guard, which redirects with the right target', () => {
    expect(shouldRedirectOnUnauthorized({ method: 'get', url: '/api/me' }, '/notes')).toBe(false);
    expect(shouldRedirectOnUnauthorized({ method: 'GET', url: '/api/me' }, '/notes')).toBe(false);
  });
});
