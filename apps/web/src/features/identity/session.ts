import type { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { getMeGetQueryOptions } from '../../shared/api/generated/endpoints/me/me';
import type { Me } from '../../shared/api/generated/models';

/**
 * The signed-in user, or `null` when there is no valid session. Any other failure (API down) is
 * thrown: it must not look like a logout.
 */
export async function fetchSession(queryClient: QueryClient): Promise<Me | null> {
  try {
    return await queryClient.ensureQueryData(getMeGetQueryOptions({ query: { retry: false } }));
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) return null;
    throw error;
  }
}
