import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { AppError } from './lib/errors';

import authRoutes from './modules/auth/auth.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import issueRoutes from './modules/issue/issue.routes';
import finesRoutes from './modules/fines/fines.routes';
import usersRoutes from './modules/users/users.routes';

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT', message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'RATE_LIMIT', message: 'Too many login attempts.' },
});

app.use(limiter);

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/fines', finesRoutes);
app.use('/api/users', usersRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  }

  // Prisma errors
  if (err && typeof err === 'object' && 'code' in err) {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'A record with this value already exists',
      });
    }
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Record not found' });
    }
  }

  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
});

export default app;
