import { NextFunction, Request, Response } from 'express';
import { env } from '@config/env';
import { AppError } from '@errors/appError';

const API_KEY_HEADER = 'x-api-key';

function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.headers[API_KEY_HEADER];
  const key = typeof provided === 'string' ? provided : undefined;

  if (!key || !env.apiKeys.includes(key)) {
    throw new AppError('Missing or invalid API key', 401, 'Unauthorized');
  }

  next();
}

export { apiKeyAuth };
