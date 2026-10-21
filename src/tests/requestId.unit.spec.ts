const getActiveSpanMock = jest.fn();
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: (...args: unknown[]) => getActiveSpanMock(...args),
  },
}));

import { Request, Response } from 'express';
import { requestId } from '@shared/infra/http/middlewares/requestId';
import { getRequestId } from '@shared/infra/http/context/requestContext';

function buildReq(headerValue?: string): Request {
  return {
    headers: headerValue === undefined ? {} : { 'x-request-id': headerValue },
  } as unknown as Request;
}

function buildRes(): Response {
  return {
    setHeader: jest.fn(),
  } as unknown as Response;
}

describe('requestId middleware', () => {
  afterEach(() => {
    getActiveSpanMock.mockReset();
  });

  it('generates a new id when no header is present', () => {
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn();

    requestId(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      expect.any(String)
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('echoes a caller-supplied header', () => {
    const req = buildReq('caller-supplied-id');
    const res = buildRes();
    const next = jest.fn();

    requestId(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'caller-supplied-id'
    );
  });

  it('generates a new id when the header is an empty string', () => {
    const req = buildReq('');
    const res = buildRes();
    const next = jest.fn();

    requestId(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      expect.any(String)
    );
    const generatedId = (res.setHeader as jest.Mock).mock.calls[0][1];
    expect(generatedId).not.toBe('');
  });

  it('runs next() inside the request context so getRequestId() resolves', () => {
    const req = buildReq('ctx-id');
    const res = buildRes();
    let observedId: string | undefined;
    const next = jest.fn(() => {
      observedId = getRequestId();
    });

    requestId(req, res, next);

    expect(observedId).toBe('ctx-id');
  });

  it('tags the active OTel span with the requestId, when one exists', () => {
    const setAttribute = jest.fn();
    getActiveSpanMock.mockReturnValue({ setAttribute });
    const req = buildReq('span-tagged-id');
    const res = buildRes();

    requestId(req, res, jest.fn());

    expect(setAttribute).toHaveBeenCalledWith('requestId', 'span-tagged-id');
  });

  it('does not throw when there is no active span to tag', () => {
    getActiveSpanMock.mockReturnValue(undefined);
    const req = buildReq();
    const res = buildRes();

    expect(() => requestId(req, res, jest.fn())).not.toThrow();
  });
});
