import { NextFunction, Request, Response } from 'express';
import { logger } from '@shared/utils/logger';

function getRouteLabel(req: Request): string {
  // Unlike the Prometheus route label, logs the real path — never a metric label, so no cardinality risk.
  return req.route ? `${req.baseUrl}${req.route.path}` : req.path;
}

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs =
      Math.round((Number(process.hrtime.bigint() - startTime) / 1e6) * 1000) /
      1000;
    const fields = {
      method: req.method,
      route: getRouteLabel(req),
      statusCode: res.statusCode,
      durationMs,
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed', fields);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed', fields);
    } else {
      logger.info('Request completed', fields);
    }
  });

  next();
}

export { requestLogger };
