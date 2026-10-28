import { Request, Response, NextFunction } from 'express';
import * as svc from './issue.service';
import { z } from 'zod';
import { routeParam } from '../../lib/routeParam';

const IssueBodySchema = z.object({
  barcode: z.string().min(1),
  userId: z.string().min(1),
});

export async function issueBook(req: Request, res: Response, next: NextFunction) {
  try {
    const { barcode, userId } = IssueBodySchema.parse(req.body);
    const result = await svc.issueBook(barcode, userId, req.user!.sub);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

export async function returnBook(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.returnBook(routeParam(req, 'id'), req.user!.sub);
    res.json(result);
  } catch (err) { next(err); }
}

export async function renewIssue(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.renewIssue(routeParam(req, 'id'), req.user!.sub, req.user!.role);
    res.json(result);
  } catch (err) { next(err); }
}

export async function listIssues(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, userId, page = '1', limit = '20' } = req.query as any;
    const result = await svc.listIssues({
      status,
      userId,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    res.json(result);
  } catch (err) { next(err); }
}

export async function getIssue(req: Request, res: Response, next: NextFunction) {
  try {
    const issue = await svc.getIssue(routeParam(req, 'id'));
    // Students can only see their own issues
    if (req.user!.role === 'STUDENT' && issue.userId !== req.user!.sub) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    res.json(issue);
  } catch (err) { next(err); }
}

export async function createReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const { bookId } = z.object({ bookId: z.string() }).parse(req.body);
    const reservation = await svc.createReservation(bookId, req.user!.sub);
    res.status(201).json(reservation);
  } catch (err) { next(err); }
}

export async function cancelReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.cancelReservation(routeParam(req, 'id'), req.user!.sub, req.user!.role);
    res.json(result);
  } catch (err) { next(err); }
}

export async function getMyIssues(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, page = '1', limit = '20' } = req.query as any;
    const result = await svc.listIssues({
      userId: req.user!.sub,
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    res.json(result);
  } catch (err) { next(err); }
}
