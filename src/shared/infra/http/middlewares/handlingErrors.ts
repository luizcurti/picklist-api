import { NextFunction, Request, Response } from 'express';
import { AppError } from '@errors/appError';
import { env } from '@config/env';
import { logger } from '@shared/utils/logger';

export function handlingErrors(
  err: Error,
  request: Request,
  response: Response,
  next: NextFunction
) {
  if (err) {
    if (err instanceof AppError) {
      return response.status(err.code).json({
        message: err.message,
        type: err.type,
      });
    }

    logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      path: request.path,
      method: request.method,
    });

    return response.status(500).json({
      message: 'Internal server error',
      ...(env.isProduction ? {} : { errorStack: err.stack }),
    });
  }

  next();
}
