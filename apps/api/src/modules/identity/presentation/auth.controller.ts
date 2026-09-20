import { isIP } from 'node:net';
import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { errorResponse } from '../../../shared/http/error-response.schema.js';
import { ZodBody, ZodResponse } from '../../../shared/http/zod.decorators.js';
import { LoginUseCase } from '../application/login.use-case.js';
import { type LoginRequest, loginRequest } from './auth.schemas.js';
import { type MeResponse, meResponse, toMeResponse } from './me.schemas.js';
import { Public } from './public.decorator.js';
import { clearSessionCookie, setSessionCookie } from './session-cookie.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  // Public: it is how a session starts.
  @Public()
  @Post('login')
  @HttpCode(200)
  @ZodResponse(200, meResponse)
  @ZodResponse(401, errorResponse)
  @ZodResponse(429, errorResponse)
  async login(
    @ZodBody(loginRequest) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    // `req.ip` honors `trust proxy` (see configureApp), so behind Caddy it is the real client.
    // Express does not validate X-Forwarded-For entries, and this value is stored.
    const ip = req.ip && isIP(req.ip) ? req.ip : 'unknown';
    const { user, token } = await this.loginUseCase.execute({ ...body, ip });
    setSessionCookie(res, token);
    return toMeResponse(user);
  }

  // Public: it must work with an expired or stale cookie, and it only ever clears the cookie.
  @Public()
  @Post('logout')
  @HttpCode(204)
  @ZodResponse(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookie(res);
  }
}
