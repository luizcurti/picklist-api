import { NextFunction, Request, Response } from 'express';

export function handlingNotFound(
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  return response.status(404).json({
    message: 'Route Not Found',
  });
}
