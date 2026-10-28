import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function meHandler(req: Request, res: Response) {
  res.json({ user: req.user });
}

export async function bootstrapHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' });
    }
    const user = await authService.createInitialAdmin(email, password, name);
    res.status(201).json({ message: 'Admin created', user });
  } catch (err) {
    next(err);
  }
}
