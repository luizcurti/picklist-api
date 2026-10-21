const getActiveSpanMock = jest.fn();
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: (...args: unknown[]) => getActiveSpanMock(...args),
  },
}));

import { logger } from '@shared/utils/logger';
import { runWithRequestId } from '@shared/infra/http/context/requestContext';

describe('logger', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    getActiveSpanMock.mockReset();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('logs info messages as JSON via console.log', () => {
    logger.info('hello', { foo: 'bar' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed).toMatchObject({
      level: 'INFO',
      message: 'hello',
      context: { foo: 'bar' },
    });
    expect(parsed.timestamp).toEqual(expect.any(String));
  });

  it('omits the context field when none is provided', () => {
    logger.info('no context');

    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed).not.toHaveProperty('context');
  });

  it('logs warn messages via console.warn', () => {
    logger.warn('careful');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warnSpy.mock.calls[0][0]).level).toBe('WARN');
  });

  it('logs error messages via console.error', () => {
    logger.error('boom');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(errorSpy.mock.calls[0][0]).level).toBe('ERROR');
  });

  it('logs debug messages via console.debug when not in production', () => {
    process.env.NODE_ENV = 'development';

    logger.debug('tracing');

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(debugSpy.mock.calls[0][0]).level).toBe('DEBUG');
  });

  it('suppresses debug messages in production', () => {
    process.env.NODE_ENV = 'production';

    logger.debug('tracing');

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('includes the request id when logging inside a request context', () => {
    runWithRequestId('req-789', () => {
      logger.info('inside request');
    });

    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.requestId).toBe('req-789');
  });

  it('omits the request id when logging outside a request context', () => {
    logger.info('outside request');

    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed).not.toHaveProperty('requestId');
  });

  it('includes the traceId when an OTel span is active', () => {
    getActiveSpanMock.mockReturnValue({
      spanContext: () => ({ traceId: 'trace-abc' }),
    });

    logger.info('traced');

    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.traceId).toBe('trace-abc');
  });

  it('omits the traceId when there is no active span (e.g. the OTel SDK never started)', () => {
    getActiveSpanMock.mockReturnValue(undefined);

    logger.info('untraced');

    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed).not.toHaveProperty('traceId');
  });
});
