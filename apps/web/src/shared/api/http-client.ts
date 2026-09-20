import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeader, getResponse } from '@tanstack/react-start/server';
import axios, { type AxiosError, type AxiosRequestConfig, isAxiosError } from 'axios';
import { shouldRedirectOnUnauthorized } from '../../features/identity/domain/unauthorized';

const instance = axios.create({ withCredentials: true });

let onSessionExpired: (() => void) | undefined;

/** Browser only (see router.tsx): what to do when a call fails with 401 in the middle of use. */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

instance.interceptors.response.use(undefined, (error: unknown) => {
  if (
    typeof window !== 'undefined' &&
    isAxiosError(error) &&
    error.response?.status === 401 &&
    error.config &&
    shouldRedirectOnUnauthorized(error.config, window.location.pathname)
  ) {
    onSessionExpired?.();
  }
  return Promise.reject(error);
});

/**
 * Browser: same-origin `/api` (Caddy in prod, Nitro devProxy in dev).
 * SSR: calls the API over the internal network and forwards the visitor's cookies.
 */
const requestDefaults = createIsomorphicFn()
  .server((): AxiosRequestConfig => {
    const cookie = getRequestHeader('cookie');
    return {
      baseURL: process.env.API_INTERNAL_URL ?? 'http://localhost:3333',
      headers: cookie ? { cookie } : {},
    };
  })
  .client((): AxiosRequestConfig => ({}));

/**
 * SSR only: the API renews a session cookie that is older than 15 days. Handing its `Set-Cookie`
 * to the page response is what makes the renewal reach the browser on a direct navigation.
 */
const forwardSetCookies = createIsomorphicFn()
  .server((cookies: string[]) => {
    const { headers } = getResponse();
    for (const cookie of cookies) headers.append('set-cookie', cookie);
  })
  .client((_cookies: string[]) => {});

/** Orval mutator: every generated request goes through here. */
export async function httpClient<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> {
  const defaults = requestDefaults();
  const { data, headers } = await instance.request<T>({
    ...defaults,
    ...config,
    ...options,
    headers: { ...defaults.headers, ...config.headers, ...options?.headers },
  });
  forwardSetCookies(headers['set-cookie'] ?? []);
  return data;
}

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<Body> = Body;
