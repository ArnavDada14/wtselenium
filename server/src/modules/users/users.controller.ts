import { Request, Response, NextFunction } from 'express';
import * as svc from './users.service';
import { CreateUserSchema, UpdateUserSchema } from './users.service';
import { routeParam } from '../../lib/routeParam';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const { role, q, page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listUsers({ role, q, page: +page, limit: +limit }));
  } catch (err) { next(err); }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getUser(routeParam(req, 'id')));
  } catch (err) { next(err); }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const input = CreateUserSchema.parse(req.body);
    const user = await svc.createUser(input);
    res.status(201).json(user);
  } catch (err) { next(err); }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const input = UpdateUserSchema.parse(req.body);
    res.json(await svc.updateUser(routeParam(req, 'id'), input));
  } catch (err) { next(err); }
}

export async function getUserHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    const targetId = routeParam(req, 'id');
    if (req.user!.role === 'STUDENT' && req.user!.sub !== targetId) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    res.json(await svc.getUserHistory(targetId, +page, +limit));
  } catch (err) { next(err); }
}

export async function getDashboardStats(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getDashboardStats());
  } catch (err) { next(err); }
}

export async function getAuditLog(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '30' } = req.query as any;
    res.json(await svc.getAuditLog(+page, +limit));
  } catch (err) { next(err); }
}
