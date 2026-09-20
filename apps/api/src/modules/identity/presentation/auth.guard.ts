import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { AuthenticateUseCase } from '../application/authenticate.use-case.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { IS_PUBLIC } from './public.decorator.js';
import { readSessionCookie, setSessionCookie } from './session-cookie.js';

/** Global guard: every route needs a valid session unless it is `@Public()`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticate: AuthenticateUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const { userId, renewedToken } = await this.authenticate.execute(
      readSessionCookie(request.headers.cookie),
    );
    request.user = { id: userId };
    // Sliding expiration: an old-but-valid token gets a fresh cookie on this response.
    if (renewedToken) setSessionCookie(http.getResponse<Response>(), renewedToken);
    return true;
  }
}
