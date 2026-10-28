import { prisma } from '../../db';
import { AppError } from '../../lib/errors';

export async function listFines(filters: {
  status?: string;
  userId?: string;
  page: number;
  limit: number;
}) {
  const { status, userId, page, limit } = filters;
  const offset = (page - 1) * limit;
  const where: any = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;

  const [fines, total] = await prisma.$transaction([
    prisma.fine.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, enrollmentId: true, email: true } },
        issue: {
          include: {
            copy: { include: { book: { select: { title: true, isbn: true } } } },
          },
        },
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.fine.count({ where }),
  ]);

  return { data: fines, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function getFine(id: string) {
  const fine = await prisma.fine.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, enrollmentId: true } },
      issue: { include: { copy: { include: { book: true } } } },
    },
  });
  if (!fine) throw new AppError('NOT_FOUND', 'Fine not found', 404);
  return fine;
}

export async function recordPayment(fineId: string, librarianId: string) {
  const fine = await prisma.fine.findUnique({ where: { id: fineId } });
  if (!fine) throw new AppError('NOT_FOUND', 'Fine not found', 404);
  if (fine.status !== 'UNPAID') {
    throw new AppError('INVALID_STATE', `Fine is already ${fine.status}`, 409);
  }

  const updated = await prisma.fine.update({
    where: { id: fineId },
    data: { status: 'PAID', paidAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: librarianId,
      action: 'fine.pay',
      entityType: 'Fine',
      entityId: fineId,
      metadata: { amount: fine.amount },
    },
  });

  return updated;
}

export async function waiveFine(
  fineId: string,
  librarianId: string,
  note: string
) {
  const fine = await prisma.fine.findUnique({ where: { id: fineId } });
  if (!fine) throw new AppError('NOT_FOUND', 'Fine not found', 404);
  if (fine.status !== 'UNPAID') {
    throw new AppError('INVALID_STATE', `Fine is already ${fine.status}`, 409);
  }

  const updated = await prisma.fine.update({
    where: { id: fineId },
    data: {
      status: 'WAIVED',
      waivedBy: librarianId,
      waivedAt: new Date(),
      waiverNote: note,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: librarianId,
      action: 'fine.waive',
      entityType: 'Fine',
      entityId: fineId,
      metadata: { amount: fine.amount, note },
    },
  });

  return updated;
}

export async function getUserFinesSummary(userId: string) {
  const [unpaid, total] = await prisma.$transaction([
    prisma.fine.aggregate({
      where: { userId, status: 'UNPAID' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.fine.aggregate({
      where: { userId },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    unpaidCount: unpaid._count,
    unpaidAmount: Number(unpaid._sum.amount ?? 0),
    totalCount: total._count,
    totalAmount: Number(total._sum.amount ?? 0),
  };
}
