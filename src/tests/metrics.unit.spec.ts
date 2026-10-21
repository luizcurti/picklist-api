import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { metrics } from '@shared/infra/http/middlewares/metrics';
import {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@shared/infra/http/metrics/registry';

function buildRes(statusCode: number): Response {
  const emitter = new EventEmitter() as unknown as Response;
  (emitter as unknown as { statusCode: number }).statusCode = statusCode;
  return emitter;
}

describe('metrics registry', () => {
  it('exposes the custom metrics through the shared registry', async () => {
    const output = await register.metrics();

    expect(output).toContain('http_requests_total');
    expect(output).toContain('http_request_duration_seconds');
    expect(output).toContain('repository_operations_total');
    expect(output).toContain('repository_operation_duration_seconds');
  });
});

describe('metrics middleware', () => {
  beforeEach(() => {
    httpRequestsTotal.reset();
    httpRequestDurationSeconds.reset();
  });

  it('records the matched Express route pattern, not the raw URL', async () => {
    const req = {
      method: 'GET',
      baseUrl: '/api/v1/products',
      route: { path: '/:product_code' },
    } as unknown as Request;
    const res = buildRes(200);
    const next = jest.fn();

    metrics(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    (res as unknown as EventEmitter).emit('finish');

    const metric = await httpRequestsTotal.get();
    expect(metric.values).toContainEqual(
      expect.objectContaining({
        labels: {
          method: 'GET',
          route: '/api/v1/products/:product_code',
          status_code: '200',
        },
        value: 1,
      })
    );
  });

  it('labels unmatched routes explicitly instead of the raw URL', async () => {
    const req = {
      method: 'GET',
      baseUrl: '',
      route: undefined,
    } as unknown as Request;
    const res = buildRes(404);
    const next = jest.fn();

    metrics(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    const metric = await httpRequestsTotal.get();
    expect(metric.values).toContainEqual(
      expect.objectContaining({
        labels: { method: 'GET', route: 'unmatched', status_code: '404' },
        value: 1,
      })
    );
  });
});
