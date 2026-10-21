import { randomUUID } from 'crypto';
import { trace } from '@opentelemetry/api';
import { NextFunction, Request, Response } from 'express';
import { runWithRequestId } from '@shared/infra/http/context/requestContext';

const REQUEST_ID_HEADER = 'x-request-id';

function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id =
    typeof incoming === 'string' && incoming.length > 0
      ? incoming
      : randomUUID();

  res.setHeader('X-Request-Id', id);

  // Reverse of logger.ts's log→trace link: makes the span searchable by requestId too.
  trace.getActiveSpan()?.setAttribute('requestId', id);

  runWithRequestId(id, next);
}

export { requestId };
