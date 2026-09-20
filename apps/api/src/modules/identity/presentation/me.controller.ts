import { Controller, Get, HttpCode, Patch, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { errorResponse } from '../../../shared/http/error-response.schema.js';
import { ZodBody, ZodResponse } from '../../../shared/http/zod.decorators.js';
import { ChangePasswordUseCase } from '../application/change-password.use-case.js';
import { GetMeUseCase } from '../application/get-me.use-case.js';
import { UpdateProfileUseCase } from '../application/update-profile.use-case.js';
import { type AuthenticatedUser, CurrentUser } from './current-user.decorator.js';
import {
  type ChangePasswordRequest,
  changePasswordRequest,
  type MeResponse,
  meResponse,
  toMeResponse,
  type UpdateMeRequest,
  updateMeRequest,
} from './me.schemas.js';
import { setSessionCookie } from './session-cookie.js';

@Controller('me')
export class MeController {
  constructor(
    private readonly getMe: GetMeUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  @Get()
  @ZodResponse(200, meResponse)
  @ZodResponse(401, errorResponse)
  async get(@CurrentUser() current: AuthenticatedUser): Promise<MeResponse> {
    return toMeResponse(await this.getMe.execute(current.id));
  }

  @Patch()
  @ZodResponse(200, meResponse)
  @ZodResponse(401, errorResponse)
  async update(
    @CurrentUser() current: AuthenticatedUser,
    @ZodBody(updateMeRequest) body: UpdateMeRequest,
  ): Promise<MeResponse> {
    return toMeResponse(await this.updateProfile.execute({ userId: current.id, ...body }));
  }

  @Put('password')
  @HttpCode(204)
  @ZodResponse(204)
  @ZodResponse(401, errorResponse)
  @ZodResponse(422, errorResponse)
  async changePassword(
    @CurrentUser() current: AuthenticatedUser,
    @ZodBody(changePasswordRequest) body: ChangePasswordRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { token } = await this.changePasswordUseCase.execute({ userId: current.id, ...body });
    // Reissued for the new tokenVersion: this device stays signed in, the others are dropped.
    setSessionCookie(res, token);
  }
}
