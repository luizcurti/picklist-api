import { Request, Response, NextFunction } from 'express';
import * as Yup from 'yup';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@shared/infra/http/middlewares/validation';

function fakeSchemaThatThrows(error: Error): Yup.AnyObjectSchema {
  return {
    validate: jest.fn().mockRejectedValue(error),
  } as unknown as Yup.AnyObjectSchema;
}

describe('validation middlewares', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = { body: {}, params: {}, query: {} };
    mockResponse = {};
    mockNext = jest.fn();
  });

  describe('validateBody', () => {
    it('rethrows non-Yup errors as-is', async () => {
      const unexpected = new Error('schema exploded');
      const middleware = validateBody(fakeSchemaThatThrows(unexpected));

      await expect(
        middleware(mockRequest as Request, mockResponse as Response, mockNext)
      ).rejects.toThrow(unexpected);
    });
  });

  describe('validateParams', () => {
    it('rethrows non-Yup errors as-is', async () => {
      const unexpected = new Error('schema exploded');
      const middleware = validateParams(fakeSchemaThatThrows(unexpected));

      await expect(
        middleware(mockRequest as Request, mockResponse as Response, mockNext)
      ).rejects.toThrow(unexpected);
    });
  });

  describe('validateQuery', () => {
    it('rethrows non-Yup errors as-is', async () => {
      const unexpected = new Error('schema exploded');
      const middleware = validateQuery(fakeSchemaThatThrows(unexpected));

      await expect(
        middleware(mockRequest as Request, mockResponse as Response, mockNext)
      ).rejects.toThrow(unexpected);
    });
  });
});
