import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: 'Query parameters invalid',
        details: result.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    // Express 5: req.query is read-only — store parsed/coerced values on res.locals
    res.locals.query = result.data;
    next();
  };
}
