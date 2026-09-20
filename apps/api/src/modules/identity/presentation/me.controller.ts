import { Controller, Get } from '@nestjs/common';
import { errorResponse } from '../../../shared/http/error-response.schema.js';
import { ZodResponse } from '../../../shared/http/zod.decorators.js';
import { GetMeUseCase } from '../application/get-me.use-case.js';
import { type AuthenticatedUser, CurrentUser } from './current-user.decorator.js';
import { type MeResponse, meResponse, toMeResponse } from './me.schemas.js';

@Controller('me')
export class MeController {
  constructor(private readonly getMe: GetMeUseCase) {}

  @Get()
  @ZodResponse(200, meResponse)
  @ZodResponse(401, errorResponse)
  async get(@CurrentUser() current: AuthenticatedUser): Promise<MeResponse> {
    return toMeResponse(await this.getMe.execute(current.id));
  }
}
