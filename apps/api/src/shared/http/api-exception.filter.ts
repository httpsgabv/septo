import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../domain-error.js';
import type { ErrorResponse } from './error-response.schema.js';

const STATUS_BY_KIND: Record<DomainError['kind'], HttpStatus> = {
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  invalid: HttpStatus.UNPROCESSABLE_ENTITY,
  forbidden: HttpStatus.FORBIDDEN,
};

/** Turns every thrown error into `{ code, message, details? }`; unexpected errors never leak. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const [status, body] = this.toResponse(error);
    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }

  private toResponse(error: unknown): [number, ErrorResponse] {
    if (error instanceof DomainError) {
      return [STATUS_BY_KIND[error.kind], { code: error.code, message: error.message }];
    }

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response = error.getResponse();
      // Already in our shape (e.g. ZodValidationPipe's VALIDATION_ERROR).
      if (typeof response === 'object' && 'code' in response) {
        return [status, response as ErrorResponse];
      }
      return [status, { code: HttpStatus[status] ?? 'HTTP_ERROR', message: error.message }];
    }

    this.logger.error(error instanceof Error ? error.stack : String(error));
    return [
      HttpStatus.INTERNAL_SERVER_ERROR,
      { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
    ];
  }
}
