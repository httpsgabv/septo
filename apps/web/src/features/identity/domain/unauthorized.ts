type Request = { method?: string; url?: string };

/**
 * Whether a `401` should send the browser to /login. It should when the session expires in the
 * middle of use; it should not when the 401 is expected (wrong password) or when the route guard,
 * which knows the page to come back to, is already handling it.
 */
export function shouldRedirectOnUnauthorized(request: Request, pathname: string): boolean {
  if (pathname === '/login' || pathname.startsWith('/login/')) return false;
  const method = request.method?.toLowerCase();
  if (method === 'post' && request.url === '/api/auth/login') return false;
  if (method === 'get' && request.url === '/api/me') return false;
  return true;
}
