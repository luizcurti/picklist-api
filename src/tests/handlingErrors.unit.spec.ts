import { Request, Response, NextFunction } from 'express';

describe('handlingErrors', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKeys = process.env.API_KEYS;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = { path: '/api/v1/products', method: 'GET' };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.API_KEYS = originalApiKeys;
    jest.resetModules();
  });

  it('calls next when there is no error', async () => {
    const { handlingErrors } =
      await import('@shared/infra/http/middlewares/handlingErrors');

    handlingErrors(
      undefined as unknown as Error,
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('responds with the AppError status code, message and type', async () => {
    const { handlingErrors } =
      await import('@shared/infra/http/middlewares/handlingErrors');
    // Import AppError from the same fresh module registry as handlingErrors,
    // otherwise `err instanceof AppError` fails across registries.
    const { AppError } = await import('@errors/appError');
    const err = new AppError('Product not found', 404, 'Not Found');

    handlingErrors(
      err,
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Product not found',
      type: 'Not Found',
    });
  });

  it('includes the stack trace for unhandled errors outside production', async () => {
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    const { handlingErrors } =
      await import('@shared/infra/http/middlewares/handlingErrors');
    const err = new Error('Something exploded');

    handlingErrors(
      err,
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    const body = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(body.errorStack).toBe(err.stack);
  });

  it('hides the stack trace for unhandled errors in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEYS = 'test-key';
    jest.resetModules();
    const { handlingErrors } =
      await import('@shared/infra/http/middlewares/handlingErrors');
    const err = new Error('Something exploded');

    handlingErrors(
      err,
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    const body = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(body).not.toHaveProperty('errorStack');
  });
});
