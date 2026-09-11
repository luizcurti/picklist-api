import {
  getRequestId,
  runWithRequestId,
} from '@shared/infra/http/context/requestContext';

describe('requestContext', () => {
  it('returns undefined outside of a request context', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('returns the request id inside runWithRequestId', () => {
    runWithRequestId('req-123', () => {
      expect(getRequestId()).toBe('req-123');
    });
  });

  it('keeps the request id readable across an async continuation', async () => {
    await runWithRequestId('req-456', async () => {
      await new Promise((resolve) => setImmediate(resolve));
      expect(getRequestId()).toBe('req-456');
    });
  });
});
