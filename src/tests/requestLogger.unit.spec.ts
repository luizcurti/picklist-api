import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { requestLogger } from '@shared/infra/http/middlewares/requestLogger';
import { logger } from '@shared/utils/logger';

function buildRes(statusCode: number): Response {
  const emitter = new EventEmitter() as unknown as Response;
  (emitter as unknown as { statusCode: number }).statusCode = statusCode;
  return emitter;
}

describe('requestLogger middleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs at info for a successful response, using the matched route pattern', () => {
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    const req = {
      method: 'GET',
      baseUrl: '/api/v1/products',
      route: { path: '/:product_code' },
      path: '/api/v1/products/SKU-1',
    } as unknown as Request;
    const res = buildRes(200);

    requestLogger(req, res, jest.fn());
    (res as unknown as EventEmitter).emit('finish');

    expect(infoSpy).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        method: 'GET',
        route: '/api/v1/products/:product_code',
        statusCode: 200,
        durationMs: expect.any(Number),
      })
    );
  });

  it('logs at warn for a 4xx response, using the raw path when unmatched', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const req = {
      method: 'GET',
      baseUrl: '',
      route: undefined,
      path: '/does-not-exist',
    } as unknown as Request;
    const res = buildRes(404);

    requestLogger(req, res, jest.fn());
    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({ route: '/does-not-exist', statusCode: 404 })
    );
  });

  it('logs at error for a 5xx response', () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const req = {
      method: 'POST',
      baseUrl: '/api/v1/products',
      route: { path: '/' },
      path: '/api/v1/products',
    } as unknown as Request;
    const res = buildRes(500);

    requestLogger(req, res, jest.fn());
    (res as unknown as EventEmitter).emit('finish');

    expect(errorSpy).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({ statusCode: 500 })
    );
  });

  it('calls next() synchronously without waiting for the response to finish', () => {
    const req = {
      method: 'GET',
      baseUrl: '',
      route: undefined,
      path: '/health',
    } as unknown as Request;
    const res = buildRes(200);
    const next = jest.fn();

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
