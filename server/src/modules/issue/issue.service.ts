import { prisma } from '../../db';
import { snowflake } from '../../lib/snowflake';
import { AppError } from '../../lib/errors';
import {
  sendMail,
  issueConfirmationEmail,
  reservationReadyEmail,
} from '../../lib/mailer';
import { addDays, differenceInCalendarDays } from 'date-fns';

const MAX_ISSUES = parseInt(process.env.MAX_ISSUES_PER_STUDENT ?? '5', 10);

// ─── Issue ────────────────────────────────────────────────────────────────────

export async function issueBook(
  barcode: string,
  userId: string,
  librarianId: string
) {
  return prisma.$transaction(async (tx) => {
    // 1. Resolve copy with book + fine policy in one query
    const copy = await tx.bookCopy.findUnique({
      where: { barcode },
      include: {
        book: {
          include: { category: { include: { finePolicy: true } } },
        },
      },
    });

    if (!copy) throw new AppError('COPY_NOT_FOUND', `Barcode not found: ${barcode}`, 404);
    if (copy.status !== 'AVAILABLE') {
      throw new AppError(
        'COPY_UNAVAILABLE',
        `This copy is currently "${copy.status}" and cannot be issued`,
        409
      );
    }

    // 2. Validate student
    const student = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, enrollmentId: true, isActive: true },
    });
    if (!student || !student.isActive) {
      throw new AppError('USER_NOT_FOUND', 'Student not found or account inactive', 404);
    }

    // 3. Check unpaid fines
    const unpaidFines = await tx.fine.count({
      where: { userId, status: 'UNPAID' },
    });
    if (unpaidFines > 0) {
      throw new AppError(
        'OUTSTANDING_FINES',
        'Student has unpaid fines. Dues must be cleared before issuing books.',
        403
      );
    }

    // 4. Check active issue limit
    const activeCount = await tx.bookIssue.count({
      where: { userId, status: { in: ['ACTIVE', 'OVERDUE'] } },
    });
    if (activeCount >= MAX_ISSUES) {
      throw new AppError(
        'ISSUE_LIMIT_REACHED',
        `Student already holds ${activeCount} books (limit: ${MAX_ISSUES})`,
        403
      );
    }

    // 5. Compute due date
    const maxDays = copy.book.category.maxIssueDays;
    const dueAt = addDays(new Date(), maxDays);
    const issueId = snowflake.nextId();

    // 6. Create issue record
    await tx.bookIssue.create({
      data: {
        id: issueId,
        copyId: copy.id,
        userId,
        issuedBy: librarianId,
        dueAt,
        status: 'ACTIVE',
      },
    });

    // 7. Mark copy as issued
    await tx.bookCopy.update({
      where: { id: copy.id },
      data: { status: 'ISSUED' },
    });

    // 8. Audit log
    await tx.auditLog.create({
      data: {
        actorId: librarianId,
        action: 'book.issue',
        entityType: 'BookIssue',
        entityId: issueId,
        metadata: { barcode, userId, dueAt },
      },
    });

    // Non-blocking email — fire after transaction
    setImmediate(() => {
      const { subject, html } = issueConfirmationEmail({
        name: student.name,
        enrollmentId: student.enrollmentId ?? undefined,
        bookTitle: copy.book.title,
        authors: copy.book.authors,
        barcode: copy.barcode,
        issuedAt: new Date(),
        dueAt,
      });
      sendMail({ to: student.email, subject, html });
    });

    return {
      issueId,
      title: copy.book.title,
      barcode: copy.barcode,
      dueAt,
      studentName: student.name,
    };
  });
}

// ─── Return ───────────────────────────────────────────────────────────────────

export async function returnBook(issueId: string, librarianId: string) {
  return prisma.$transaction(async (tx) => {
    const issue = await tx.bookIssue.findUnique({
      where: { id: issueId },
      include: {
        copy: {
          include: {
            book: { include: { category: { include: { finePolicy: true } } } },
          },
        },
        issuedTo: { select: { id: true, name: true, email: true, enrollmentId: true } },
      },
    });

    if (!issue) throw new AppError('NOT_FOUND', 'Issue record not found', 404);
    if (issue.status === 'RETURNED') {
      throw new AppError('ALREADY_RETURNED', 'This book has already been returned', 409);
    }

    const now = new Date();
    let fineId: string | null = null;
    let fineAmount: number | null = null;

    // Calculate fine if overdue
    if (now > issue.dueAt) {
      const policy = issue.copy.book.category.finePolicy;
      if (policy) {
        const overdueDays = differenceInCalendarDays(now, issue.dueAt);
        const billable = Math.max(0, overdueDays - policy.gracePeriodDays);

        if (billable > 0) {
          const raw = billable * Number(policy.ratePerDay);
          fineAmount = policy.maxFineAmount
            ? Math.min(raw, Number(policy.maxFineAmount))
            : raw;

          fineId = snowflake.nextId();
          await tx.fine.create({
            data: {
              id: fineId,
              issueId: issue.id,
              userId: issue.userId,
              amount: fineAmount,
              reason: 'OVERDUE',
              status: 'UNPAID',
            },
          });
        }
      }
    }

    // Update issue
    await tx.bookIssue.update({
      where: { id: issueId },
      data: { status: 'RETURNED', returnedAt: now, returnedBy: librarianId },
    });

    // Free the copy
    await tx.bookCopy.update({
      where: { id: issue.copyId },
      data: { status: 'AVAILABLE' },
    });

    // Audit
    await tx.auditLog.create({
      data: {
        actorId: librarianId,
        action: 'book.return',
        entityType: 'BookIssue',
        entityId: issueId,
        metadata: { fineId, fineAmount },
      },
    });

    // Notify next in reservation queue (outside transaction is fine — worst case reservation is delayed 1 cycle)
    setImmediate(() =>
      fulfillNextReservation(issue.copy.bookId)
    );

    return {
      returned: true,
      bookTitle: issue.copy.book.title,
      fine: fineAmount ? { id: fineId, amount: fineAmount } : null,
    };
  });
}

async function fulfillNextReservation(bookId: string) {
  const next = await prisma.reservation.findFirst({
    where: { bookId, status: 'PENDING' },
    orderBy: { reservedAt: 'asc' },
    include: { user: { select: { email: true, name: true } }, book: { select: { title: true } } },
  });
  if (!next) return;

  const expiresAt = addDays(new Date(), 2);
  await prisma.reservation.update({
    where: { id: next.id },
    data: { status: 'READY', notifiedAt: new Date(), expiresAt },
  });

  const { subject, html } = reservationReadyEmail({
    name: next.user.name,
    bookTitle: next.book.title,
    expiresAt,
  });
  sendMail({ to: next.user.email, subject, html });
}

// ─── Renewal ─────────────────────────────────────────────────────────────────

export async function renewIssue(issueId: string, requestorId: string, requestorRole: string) {
  return prisma.$transaction(async (tx) => {
    const issue = await tx.bookIssue.findUnique({
      where: { id: issueId },
      include: {
        copy: { include: { book: { include: { category: true } } } },
      },
    });

    if (!issue) throw new AppError('NOT_FOUND', 'Issue not found', 404);
    if (issue.status !== 'ACTIVE') {
      throw new AppError('INVALID_STATE', 'Only active issues can be renewed', 409);
    }
    if (requestorRole === 'STUDENT' && issue.userId !== requestorId) {
      throw new AppError('FORBIDDEN', 'You can only renew your own books', 403);
    }

    const renewalCount = await tx.issueRenewal.count({ where: { issueId } });
    const maxRenewals = issue.copy.book.category.maxRenewals;
    if (renewalCount >= maxRenewals) {
      throw new AppError(
        'RENEWAL_LIMIT',
        `Maximum renewals (${maxRenewals}) reached for this book`,
        409
      );
    }

    // Reject renewal if a reservation is pending on this book
    const pendingReservation = await tx.reservation.count({
      where: { bookId: issue.copy.bookId, status: 'PENDING' },
    });
    if (pendingReservation > 0) {
      throw new AppError(
        'RESERVATION_PENDING',
        'This book has pending reservations and cannot be renewed',
        409
      );
    }

    const newDueAt = addDays(issue.dueAt, issue.copy.book.category.maxIssueDays);

    await tx.issueRenewal.create({
      data: {
        issueId,
        newDueAt,
        renewedBy: requestorId,
      },
    });

    await tx.bookIssue.update({ where: { id: issueId }, data: { dueAt: newDueAt } });

    return { issueId, newDueAt, renewalsUsed: renewalCount + 1, maxRenewals };
  });
}

// ─── List Issues ──────────────────────────────────────────────────────────────

export async function listIssues(filters: {
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

  const [issues, total] = await prisma.$transaction([
    prisma.bookIssue.findMany({
      where,
      include: {
        copy: { include: { book: { select: { title: true, authors: true, isbn: true } } } },
        issuedTo: { select: { id: true, name: true, enrollmentId: true, email: true } },
        renewals: { select: { id: true } },
      },
      skip: offset,
      take: limit,
      orderBy: { issuedAt: 'desc' },
    }),
    prisma.bookIssue.count({ where }),
  ]);

  return { data: issues, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function getIssue(id: string) {
  const issue = await prisma.bookIssue.findUnique({
    where: { id },
    include: {
      copy: { include: { book: true } },
      issuedTo: { select: { id: true, name: true, enrollmentId: true, email: true } },
      renewals: true,
      fines: true,
    },
  });
  if (!issue) throw new AppError('NOT_FOUND', 'Issue not found', 404);
  return issue;
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export async function createReservation(bookId: string, userId: string) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: { copies: { where: { status: 'AVAILABLE' } } },
  });
  if (!book) throw new AppError('NOT_FOUND', 'Book not found', 404);
  if (book.copies.length > 0) {
    throw new AppError('BOOK_AVAILABLE', 'Book is currently available — issue it directly', 409);
  }

  const existing = await prisma.reservation.findFirst({
    where: { bookId, userId, status: { in: ['PENDING', 'READY'] } },
  });
  if (existing) throw new AppError('ALREADY_RESERVED', 'You already have an active reservation for this book', 409);

  return prisma.reservation.create({ data: { bookId, userId } });
}

export async function cancelReservation(id: string, requestorId: string, role: string) {
  const res = await prisma.reservation.findUnique({ where: { id } });
  if (!res) throw new AppError('NOT_FOUND', 'Reservation not found', 404);
  if (role === 'STUDENT' && res.userId !== requestorId) {
    throw new AppError('FORBIDDEN', 'Access denied', 403);
  }
  return prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED' } });
}
