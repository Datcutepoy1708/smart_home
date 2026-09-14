import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = response.getHeader('X-Request-Id') ?? randomUUID();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const body = error instanceof HttpException ? error.getResponse() : null;
    const message =
      status >= 500
        ? 'Service temporarily unavailable'
        : typeof body === 'object' && body && 'message' in body
          ? body.message
          : 'Request failed';
    if (status >= 500)
      this.logger.error(
        JSON.stringify({
          requestId,
          code: 'INTERNAL_ERROR',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }),
      );
    response.setHeader('X-Request-Id', requestId);
    response
      .status(status)
      .json({ code: `HTTP_${status}`, message, requestId });
  }
}
