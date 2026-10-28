import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db';
import { snowflake } from '../../lib/snowflake';
import { AppError } from '../../lib/errors';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;

function signAccessToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY ?? '15m',
  } as jwt.SignOptions);
}

function signRefreshToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  } as jwt.SignOptions);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const tokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  return {
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function refresh(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('INVALID_TOKEN', 'User not found or inactive', 401);
    }

    const tokenPayload = { sub: user.id, email: user.email, role: user.role, name: user.name };
    return {
      accessToken: signAccessToken(tokenPayload),
      refreshToken: signRefreshToken(tokenPayload),
    };
  } catch {
    throw new AppError('INVALID_TOKEN', 'Refresh token is invalid or expired', 401);
  }
}

export async function createInitialAdmin(email: string, password: string, name: string) {
  const existing = await prisma.user.findFirst({ where: { role: 'SYSTEM_ADMIN' } });
  if (existing) throw new AppError('CONFLICT', 'Admin already exists', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: {
      id: snowflake.nextId(),
      email,
      passwordHash,
      name,
      role: 'SYSTEM_ADMIN',
    },
    select: { id: true, email: true, name: true, role: true },
  });
}
