import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

export interface JwtPayload {
  sub: string;     // user ID (Snowflake)
  email: string;
  role: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHENTICATED', 'No token provided', 401));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    next(new AppError('INVALID_TOKEN', 'Token is invalid or expired', 401));
  }
}
