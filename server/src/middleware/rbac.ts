import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

type Role = 'STUDENT' | 'LIBRARIAN' | 'SYSTEM_ADMIN';

const hierarchy: Record<Role, number> = {
  STUDENT: 0,
  LIBRARIAN: 1,
  SYSTEM_ADMIN: 2,
};

export function requireRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('UNAUTHENTICATED', 'Authentication required', 401));
    }
    const userLevel = hierarchy[req.user.role as Role] ?? -1;
    if (userLevel < hierarchy[minRole]) {
      return next(new AppError('FORBIDDEN', 'Insufficient permissions', 403));
    }
    next();
  };
}

/** Allows the authenticated user to access their own resource, or any librarian/admin */
export function requireSelfOrLibrarian(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError('UNAUTHENTICATED', 'Authentication required', 401));
  }
  const targetId = req.params.userId ?? req.params.id;
  const isSelf = req.user.sub === targetId;
  const isLibrarian = (hierarchy[req.user.role as Role] ?? -1) >= hierarchy['LIBRARIAN'];
  if (!isSelf && !isLibrarian) {
    return next(new AppError('FORBIDDEN', 'Access denied', 403));
  }
  next();
}
