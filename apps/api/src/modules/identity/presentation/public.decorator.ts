import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/**
 * Opts a handler out of the global `AuthGuard`. Every route is protected by default, so each use
 * needs a justification in the PR.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
