import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type AuthenticatedUser = { id: string };
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** The user the `AuthGuard` identified. Never used on `@Public()` handlers. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const { user } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!user) throw new Error('@CurrentUser() used on a route the AuthGuard does not protect');
  return user;
});
