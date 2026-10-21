import { Request, Response, NextFunction } from 'express';
import { AppError } from '@errors/appError';
import { stripDangerousKeys } from '@shared/utils/stripDangerousKeys';
import * as Yup from 'yup';

export function validateBody(schema: Yup.AnyObjectSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.validate(stripDangerousKeys(req.body), {
        abortEarly: false,
        stripUnknown: true,
      });
      req.body = validated;
      next();
    } catch (err) {
      if (err instanceof Yup.ValidationError) {
        throw new AppError(err.errors.join(', '), 400, 'VALIDATION_FAILED', {
          errors: err.errors,
        });
      }
      throw err;
    }
  };
}

export function validateParams(schema: Yup.AnyObjectSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.validate(stripDangerousKeys(req.params), {
        abortEarly: false,
        stripUnknown: true,
      });
      req.params = validated;
      next();
    } catch (err) {
      if (err instanceof Yup.ValidationError) {
        throw new AppError(err.errors.join(', '), 400, 'VALIDATION_FAILED', {
          errors: err.errors,
        });
      }
      throw err;
    }
  };
}

export function validateQuery(schema: Yup.AnyObjectSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.validate(stripDangerousKeys(req.query), {
        abortEarly: false,
        stripUnknown: true,
      });
      req.query = validated;
      next();
    } catch (err) {
      if (err instanceof Yup.ValidationError) {
        throw new AppError(err.errors.join(', '), 400, 'VALIDATION_FAILED', {
          errors: err.errors,
        });
      }
      throw err;
    }
  };
}
