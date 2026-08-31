import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  AllExceptionsFilter,
  ErrorResponseBody,
} from './all-exceptions.filter';

function createMockHost(url = '/api/v1/test') {
  const json = jest.fn<void, [ErrorResponseBody]>();
  const status = jest.fn().mockReturnValue({ json });
  const getResponse = jest.fn().mockReturnValue({ status });
  const getRequest = jest.fn().mockReturnValue({ method: 'GET', url });
  const host = {
    switchToHttp: () => ({ getResponse, getRequest }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('normalizes a plain HttpException message to a string', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not found',
      }),
    );
  });

  it('joins a class-validator string[] message into a single string', () => {
    // This is the exact scenario the frontend's extractApiErrorMessage()
    // (apps/web/src/utils/apiError.ts) needs `message` to be a string for —
    // ValidationPipe's default behavior returns an array here.
    const { host, json } = createMockHost();
    filter.catch(
      new BadRequestException([
        'email must be an email',
        'password is too short',
      ]),
      host,
    );

    const body = json.mock.calls[0][0];
    expect(typeof body.message).toBe('string');
    expect(body.message).toBe('email must be an email; password is too short');
  });

  it('never leaks internal error details for a 500-level non-HttpException', () => {
    const { host, json } = createMockHost();
    filter.catch(
      new Error('Connection refused at 10.0.0.5:5432 — password auth failed'),
      host,
    );

    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.message).toBe('Something went wrong. Please try again.');
    expect(body.message).not.toContain('10.0.0.5');
  });

  it('includes the request path and a timestamp in every error response', () => {
    const { host, json } = createMockHost('/api/v1/orders/123');
    filter.catch(new HttpException('Forbidden', HttpStatus.FORBIDDEN), host);

    const body = json.mock.calls[0][0];
    expect(body.path).toBe('/api/v1/orders/123');
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it('preserves a specific 4xx message rather than the generic fallback', () => {
    const { host, json } = createMockHost();
    filter.catch(
      new HttpException('Email already registered', HttpStatus.CONFLICT),
      host,
    );

    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(HttpStatus.CONFLICT);
    expect(body.message).toBe('Email already registered');
  });
});
