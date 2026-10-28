import { prisma } from '../../db';
import { snowflake } from '../../lib/snowflake';
import { AppError } from '../../lib/errors';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['STUDENT', 'LIBRARIAN', 'SYSTEM_ADMIN']).default('STUDENT'),
  enrollmentId: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['STUDENT', 'LIBRARIAN']).optional(),
});

export async function listUsers(filters: {
  role?: string;
  q?: string;
  page: number;
  limit: number;
}) {
  const { role, q, page, limit } = filters;
  const offset = (page - 1) * limit;
  const where: any = {};
  if (role) where.role = role;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { enrollmentId: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, name: true, role: true,
        enrollmentId: true, department: true, phone: true,
        isActive: true, createdAt: true,
      },
      skip: offset,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { data: users, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, role: true,
      enrollmentId: true, department: true, phone: true,
      isActive: true, createdAt: true,
      _count: {
        select: {
          issuedBooks: true,
          fines: true,
          reservations: true,
        },
      },
    },
  });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
  return user;
}

export async function createUser(input: z.infer<typeof CreateUserSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError('CONFLICT', 'Email already in use', 409);

  if (input.enrollmentId) {
    const dup = await prisma.user.findUnique({ where: { enrollmentId: input.enrollmentId } });
    if (dup) throw new AppError('CONFLICT', 'Enrollment ID already registered', 409);
  }

  const { password, ...rest } = input;
  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.user.create({
    data: { id: snowflake.nextId(), passwordHash, ...rest },
    select: { id: true, email: true, name: true, role: true, enrollmentId: true },
  });
}

export async function updateUser(id: string, input: z.infer<typeof UpdateUserSchema>) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
  return prisma.user.update({
    where: { id },
    data: input,
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
}

export async function getUserHistory(userId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [issues, total] = await prisma.$transaction([
    prisma.bookIssue.findMany({
      where: { userId },
      include: {
        copy: { include: { book: { select: { title: true, isbn: true, authors: true } } } },
        fines: { select: { id: true, amount: true, status: true, reason: true } },
      },
      skip: offset,
      take: limit,
      orderBy: { issuedAt: 'desc' },
    }),
    prisma.bookIssue.count({ where: { userId } }),
  ]);
  return { data: issues, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    issuedToday,
    activeIssues,
    overdueIssues,
    dueTodayIssues,
    pendingReservations,
    unpaidFinesTotal,
    totalBooks,
    totalStudents,
  ] = await prisma.$transaction([
    prisma.bookIssue.count({ where: { issuedAt: { gte: today, lt: tomorrow } } }),
    prisma.bookIssue.count({ where: { status: { in: ['ACTIVE', 'OVERDUE'] } } }),
    prisma.bookIssue.count({ where: { status: 'OVERDUE' } }),
    prisma.bookIssue.count({ where: { status: 'ACTIVE', dueAt: { gte: today, lt: tomorrow } } }),
    prisma.reservation.count({ where: { status: 'PENDING' } }),
    prisma.fine.aggregate({ where: { status: 'UNPAID' }, _sum: { amount: true } }),
    prisma.book.count(),
    prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
  ]);

  return {
    issuedToday,
    activeIssues,
    overdueIssues,
    dueTodayIssues,
    pendingReservations,
    unpaidFinesTotal: Number(unpaidFinesTotal._sum.amount ?? 0),
    totalBooks,
    totalStudents,
  };
}

export async function getAuditLog(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: { timestamp: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.auditLog.count(),
  ]);
  return { data: logs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}
