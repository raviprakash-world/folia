import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ErrorResponseBody {
  statusCode: number;
  message: string;
  error: string;
  path: string;
  timestamp: string;
}

/**
 * Every error response is normalized to { statusCode, message, error,
 * path, timestamp } with `message` ALWAYS a single string — this is the
 * one field the frontend's existing extractApiErrorMessage() reads
 * (apps/web/src/utils/apiError.ts: error.response.data.message). Without
 * this normalization, class-validator's default behavior returns
 * `message` as a string ARRAY for validation errors, which would silently
 * break every existing frontend error-toast call site expecting a string.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status: number =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception, status);
    const errorName =
      exception instanceof HttpException
        ? exception.name
        : 'InternalServerError';

    const body: ErrorResponseBody = {
      statusCode: status,
      message,
      error: errorName,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status}: ${message}`,
      );
    }

    response.status(status).json(body);
  }

  private extractMessage(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const responseBody = exception.getResponse();
      if (typeof responseBody === 'string') return responseBody;
      if (
        typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody
      ) {
        const raw = responseBody.message;
        // class-validator's ValidationPipe returns message as string[] — join into one string.
        if (Array.isArray(raw)) return raw.join('; ');
        if (typeof raw === 'string') return raw;
      }
    }
    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      // Never leak internal error details (stack traces, DB error text) to the client.
      return 'Something went wrong. Please try again.';
    }
    return exception instanceof Error
      ? exception.message
      : 'An unexpected error occurred.';
  }
}
