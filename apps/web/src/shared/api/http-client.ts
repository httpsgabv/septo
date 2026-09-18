import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

const instance = axios.create({ withCredentials: true });

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

/** Orval mutator: every generated request goes through here. */
export async function httpClient<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> {
  const defaults = requestDefaults();
  const { data } = await instance.request<T>({
    ...defaults,
    ...config,
    ...options,
    headers: { ...defaults.headers, ...config.headers, ...options?.headers },
  });
  return data;
}

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<Body> = Body;
