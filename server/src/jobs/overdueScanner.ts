import cron from 'node-cron';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { prisma } from '../db';
import { sendMail, dueReminderEmail, overdueAlertEmail } from '../lib/mailer';

/**
 * Overdue Scanner — runs every day at 23:00
 *
 * Responsibilities:
 * 1. Send 2-day advance due reminders for ACTIVE issues
 * 2. Mark ACTIVE issues past due date as OVERDUE
 * 3. Send overdue alert emails
 *
 * Design note: Fine records are NOT created here.
 * Fines are computed and recorded only at return time, based on
 * actual days overdue. This keeps Fine table clean and auditable.
 */
export function startOverdueScanner() {
  cron.schedule('0 23 * * *', async () => {
    console.log('[OverdueScanner] Starting daily scan...');
    const now = new Date();

    try {
      // ── 1. Due reminders (issues due in exactly 1 or 2 days) ─────────────
      const reminderWindow = addDays(now, 2);

      const upcoming = await prisma.bookIssue.findMany({
        where: {
          status: 'ACTIVE',
          dueAt: { gte: now, lte: reminderWindow },
        },
        include: {
          copy: { include: { book: { select: { title: true } } } },
          issuedTo: { select: { email: true, name: true } },
        },
      });

      let remindersQueued = 0;
      for (const issue of upcoming) {
        const daysLeft = differenceInCalendarDays(issue.dueAt, now);
        const { subject, html } = dueReminderEmail({
          name: issue.issuedTo.name,
          bookTitle: issue.copy.book.title,
          dueAt: issue.dueAt,
          daysLeft,
        });
        // Fire-and-forget; mailer already handles errors internally
        sendMail({ to: issue.issuedTo.email, subject, html });
        remindersQueued++;
      }

      // ── 2. Mark overdue + alert ───────────────────────────────────────────
      const overdueIssues = await prisma.bookIssue.findMany({
        where: {
          status: 'ACTIVE',
          dueAt: { lt: now },
        },
        include: {
          copy: {
            include: {
              book: {
                include: { category: { include: { finePolicy: true } } },
              },
            },
          },
          issuedTo: { select: { email: true, name: true } },
        },
      });

      if (overdueIssues.length > 0) {
        // Bulk status update
        await prisma.bookIssue.updateMany({
          where: { id: { in: overdueIssues.map((i) => i.id) } },
          data: { status: 'OVERDUE' },
        });

        for (const issue of overdueIssues) {
          const ratePerDay = Number(
            issue.copy.book.category.finePolicy?.ratePerDay ?? 0
          );
          const { subject, html } = overdueAlertEmail({
            name: issue.issuedTo.name,
            bookTitle: issue.copy.book.title,
            dueAt: issue.dueAt,
            ratePerDay,
          });
          sendMail({ to: issue.issuedTo.email, subject, html });
        }
      }

      // ── 3. Expire stale READY reservations ────────────────────────────────
      await prisma.reservation.updateMany({
        where: {
          status: 'READY',
          expiresAt: { lt: now },
        },
        data: { status: 'EXPIRED' },
      });

      console.log(
        `[OverdueScanner] Done. Reminders: ${remindersQueued}, Overdue: ${overdueIssues.length}`
      );
    } catch (err) {
      console.error('[OverdueScanner] Error during scan:', err);
    }
  });

  console.log('[OverdueScanner] Scheduled — runs daily at 23:00');
}
