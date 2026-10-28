import { Request } from 'express';
import { AppError } from './errors';

export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') {
    throw new AppError('INVALID_PARAMETER', `Invalid route parameter: ${name}`);
  }
  return value;
}
