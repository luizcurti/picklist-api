import { Request, Response } from 'express';
import { apiKeyAuth } from '@shared/infra/http/middlewares/apiKeyAuth';
import { DEFAULT_DEV_API_KEY } from '@config/env';
import { AppError } from '@errors/appError';

function buildReq(headerValue?: string): Request {
  return {
    headers: headerValue === undefined ? {} : { 'x-api-key': headerValue },
  } as unknown as Request;
}

describe('apiKeyAuth middleware', () => {
  it('calls next() when a valid key is provided', () => {
    const req = buildReq(DEFAULT_DEV_API_KEY);
    const next = jest.fn();

    apiKeyAuth(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('throws a 401 AppError when no key is provided', () => {
    const req = buildReq();
    const next = jest.fn();

    expect(() => apiKeyAuth(req, {} as Response, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws a 401 AppError when the key is wrong', () => {
    const req = buildReq('not-a-real-key');
    const next = jest.fn();

    expect(() => apiKeyAuth(req, {} as Response, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a non-string header value (e.g. sent twice)', () => {
    const req = {
      headers: { 'x-api-key': ['a', 'b'] },
    } as unknown as Request;
    const next = jest.fn();

    expect(() => apiKeyAuth(req, {} as Response, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });
});
