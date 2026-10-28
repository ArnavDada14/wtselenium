import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as svc from './fines.service';
import { routeParam } from '../../lib/routeParam';

export async function listFines(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, userId, page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listFines({ status, userId, page: +page, limit: +limit }));
  } catch (err) { next(err); }
}

export async function getMyFines(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listFines({ userId: req.user!.sub, status, page: +page, limit: +limit }));
  } catch (err) { next(err); }
}

export async function getFine(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getFine(routeParam(req, 'id')));
  } catch (err) { next(err); }
}

export async function recordPayment(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.recordPayment(routeParam(req, 'id'), req.user!.sub));
  } catch (err) { next(err); }
}

export async function waiveFine(req: Request, res: Response, next: NextFunction) {
  try {
    const { note } = z.object({ note: z.string().min(1) }).parse(req.body);
    res.json(await svc.waiveFine(routeParam(req, 'id'), req.user!.sub, note));
  } catch (err) { next(err); }
}

export async function getMyFinesSummary(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getUserFinesSummary(req.user!.sub));
  } catch (err) { next(err); }
}
