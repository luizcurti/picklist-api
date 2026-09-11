import { AppError } from '@errors/appError';

describe('AppError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create AppError with all parameters', () => {
      const message = 'Test error message';
      const code = 404;
      const type = 'Not Found';
      const data = { field: 'test' };

      const error = new AppError(message, code, type, data);

      expect(error.message).toBe(message);
      expect(error.code).toBe(code);
      expect(error.type).toBe(type);
      expect(error.data).toEqual(data);
      expect(error.name).toBe('AppError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create AppError with default parameters', () => {
      const error = new AppError();

      expect(error.message).toBe('');
      expect(error.code).toBe(400);
      expect(error.type).toBe('Bad Request');
      expect(error.data).toEqual({});
      expect(error.name).toBe('AppError');
    });

    it('should create AppError with partial parameters', () => {
      const message = 'Custom message';
      const error = new AppError(message);

      expect(error.message).toBe(message);
      expect(error.code).toBe(400);
      expect(error.type).toBe('Bad Request');
      expect(error.data).toEqual({});
    });

    it('should create AppError with message and code only', () => {
      const message = 'Validation failed';
      const code = 422;
      const error = new AppError(message, code);

      expect(error.message).toBe(message);
      expect(error.code).toBe(code);
      expect(error.type).toBe('Bad Request');
      expect(error.data).toEqual({});
    });

    it('should create AppError with message, code and type', () => {
      const message = 'Server error';
      const code = 500;
      const type = 'Internal Server Error';
      const error = new AppError(message, code, type);

      expect(error.message).toBe(message);
      expect(error.code).toBe(code);
      expect(error.type).toBe(type);
      expect(error.data).toEqual({});
    });

    it('should handle null and undefined data', () => {
      const errorWithNull = new AppError('Test', 400, 'Bad Request', null);
      const errorWithUndefined = new AppError(
        'Test',
        400,
        'Bad Request',
        undefined
      );

      expect(errorWithNull.data).toBeNull();
      expect(errorWithUndefined.data).toEqual({});
    });

    it('should handle different data types', () => {
      const stringData = 'string data';
      const numberData = 42;
      const arrayData = [1, 2, 3];
      const objectData = { key: 'value' };

      const errorString = new AppError('Test', 400, 'Bad Request', stringData);
      const errorNumber = new AppError('Test', 400, 'Bad Request', numberData);
      const errorArray = new AppError('Test', 400, 'Bad Request', arrayData);
      const errorObject = new AppError('Test', 400, 'Bad Request', objectData);

      expect(errorString.data).toBe(stringData);
      expect(errorNumber.data).toBe(numberData);
      expect(errorArray.data).toEqual(arrayData);
      expect(errorObject.data).toEqual(objectData);
    });
  });

  describe('Error.captureStackTrace coverage', () => {
    it('should call Error.captureStackTrace when available', () => {
      const originalCaptureStackTrace = Error.captureStackTrace;
      const mockCaptureStackTrace = jest.fn();

      Error.captureStackTrace = mockCaptureStackTrace;

      const error = new AppError('Test error');

      expect(mockCaptureStackTrace).toHaveBeenCalledWith(error, AppError);

      Error.captureStackTrace = originalCaptureStackTrace;
    });

    it('should handle when Error.captureStackTrace is not available', () => {
      const originalCaptureStackTrace = Error.captureStackTrace;

      (Error as unknown as Record<string, unknown>).captureStackTrace =
        undefined;

      expect(() => {
        new AppError('Test error');
      }).not.toThrow();

      Error.captureStackTrace = originalCaptureStackTrace;
    });

    it('should handle when Error.captureStackTrace is null', () => {
      const originalCaptureStackTrace = Error.captureStackTrace;

      (Error as unknown as Record<string, unknown>).captureStackTrace = null;

      expect(() => {
        new AppError('Test error');
      }).not.toThrow();

      Error.captureStackTrace = originalCaptureStackTrace;
    });
  });

  describe('inheritance', () => {
    it('should be throwable', () => {
      expect(() => {
        throw new AppError('Test error', 500, 'Internal Server Error');
      }).toThrow(AppError);
    });

    it('should be catchable as Error', () => {
      try {
        throw new AppError('Test error', 404, 'Not Found');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(404);
        expect((error as AppError).type).toBe('Not Found');
      }
    });

    it('should maintain stack trace', () => {
      const error = new AppError('Test error');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('edge cases', () => {
    it('should handle extremely long messages', () => {
      const longMessage = 'a'.repeat(10000);
      const error = new AppError(longMessage);

      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(10000);
    });

    it('should handle special characters in message', () => {
      const specialMessage = '🚀 Error with émojis and spëcial chàracters!';
      const error = new AppError(specialMessage);

      expect(error.message).toBe(specialMessage);
    });

    it('should handle negative error codes', () => {
      const error = new AppError('Test', -1);

      expect(error.code).toBe(-1);
    });

    it('should handle zero error code', () => {
      const error = new AppError('Test', 0);

      expect(error.code).toBe(0);
    });

    it('should handle very large error codes', () => {
      const largeCode = 999999;
      const error = new AppError('Test', largeCode);

      expect(error.code).toBe(largeCode);
    });
  });
});
