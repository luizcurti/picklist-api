import express, { Application, NextFunction, Request, Response } from 'express';
import 'express-async-errors';

import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { env } from '@config/env';
import { routes } from './http/routes/index';
import { openapiSpec } from './http/docs/openapi';
import { requestId } from './http/middlewares/requestId';
import { requestLogger } from './http/middlewares/requestLogger';
import { metrics } from './http/middlewares/metrics';
import { jsonParseErrorHandler } from './http/middlewares/jsonParseErrorHandler';
import { safeJsonReviver } from '@shared/utils/safeJsonReviver';
import { register } from './http/metrics/registry';
import { getReadiness } from './http/health/readiness';

class App {
  public server: Application;

  constructor() {
    this.server = express();
  }

  async init() {
    this.middlewares();
    this.routes();
  }

  middlewares() {
    this.server.use(requestId);
    this.server.use(requestLogger);
    this.server.use(metrics);
    this.server.use(
      cors({
        // Literal '*', not `true` (origin reflection) — can't silently turn
        // unsafe if `credentials: true` is ever added (CodeQL-flagged pattern).
        origin: env.corsOrigin === '*' ? '*' : env.corsOrigin.split(','),
      })
    );
    this.server.use(helmet());
    this.server.use(express.urlencoded({ extended: true }));
    this.server.use(express.json({ reviver: safeJsonReviver }));
    this.server.use(jsonParseErrorHandler);
    this.server.use(
      '/api',
      rateLimit({
        windowMs: env.rateLimit.windowMs,
        max: env.rateLimit.max,
        standardHeaders: true,
        legacyHeaders: false,
      })
    );

    console.log('[SERVER] MIDDLEWARES REGISTERED');
  }

  routes() {
    const liveness = (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    };

    // Kept for backward compatibility (documented, used by the Docker
    // HEALTHCHECK and existing tests) as an alias of /health/live.
    this.server.get('/health', liveness);
    this.server.get('/health/live', liveness);

    this.server.get('/health/ready', async (_req: Request, res: Response) => {
      const { ready, checks } = await getReadiness();
      res.status(ready ? 200 : 503).json({
        status: ready ? 'ok' : 'degraded',
        checks,
      });
    });

    this.server.get('/metrics', async (_req: Request, res: Response) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });

    this.server.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

    // Auth is enforced inside `routes`, not here — see routes/index.ts.
    this.server.use('/api/v1', routes);

    // Global 404 handler for paths outside /api/v1
    this.server.use((_req: Request, res: Response, _next: NextFunction) => {
      res.status(404).json({ message: 'Route Not Found' });
    });

    console.log('[SERVER] ROUTES REGISTERED');
  }
}

export { App };
