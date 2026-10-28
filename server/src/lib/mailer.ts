import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM ?? 'Library <library@college.edu>';

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email. Fire-and-forget: errors are logged but do not
 * propagate to the caller — a failed notification must never fail
 * a library transaction.
 */
export async function sendMail(options: MailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  } catch (err) {
    console.error('[Mailer] Failed to send email to', options.to, err);
  }
}

// ─── Email Templates ─────────────────────────────────────────────────────────

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Library Notification</title>
  <style>
    body { font-family: 'Georgia', serif; background: #f5f4f2; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border: 1px solid #d4d0ca; }
    .header { background: #1a1917; padding: 24px 32px; }
    .header h1 { color: #f5f4f2; font-size: 16px; font-weight: 600; margin: 0; letter-spacing: 0.05em; font-family: 'Arial', sans-serif; }
    .header p { color: #8c8884; font-size: 12px; margin: 4px 0 0; font-family: 'Arial', sans-serif; }
    .body { padding: 32px; }
    .body p { color: #1a1917; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .detail-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    .detail-table td { padding: 10px 12px; font-size: 13px; font-family: 'Arial', sans-serif; border-bottom: 1px solid #eceae6; }
    .detail-table td:first-child { color: #5c5954; font-weight: 500; width: 40%; }
    .detail-table td:last-child { color: #1a1917; font-weight: 600; }
    .status-badge { display: inline-block; padding: 3px 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; font-family: 'Arial', sans-serif; }
    .status-active { background: #e8f2eb; color: #1a5c2e; }
    .status-overdue { background: #f2e8e8; color: #8b1a1a; }
    .footer { padding: 16px 32px; border-top: 1px solid #eceae6; background: #f5f4f2; }
    .footer p { color: #8c8884; font-size: 11px; font-family: 'Arial', sans-serif; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>COLLEGE LIBRARY</h1>
      <p>Library Management System</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated notification from the Library Management System. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

export function issueConfirmationEmail(data: {
  name: string;
  enrollmentId?: string;
  bookTitle: string;
  authors: string[];
  barcode: string;
  issuedAt: Date;
  dueAt: Date;
}): { subject: string; html: string } {
  return {
    subject: `Book Issued: ${data.bookTitle}`,
    html: baseLayout(`
      <p>Dear ${data.name},</p>
      <p>A book has been issued to you from the college library. Please return it on or before the due date to avoid fines.</p>
      <table class="detail-table">
        <tr><td>Title</td><td>${data.bookTitle}</td></tr>
        <tr><td>Author(s)</td><td>${data.authors.join(', ')}</td></tr>
        <tr><td>Barcode</td><td style="font-family: monospace;">${data.barcode}</td></tr>
        <tr><td>Enrollment ID</td><td>${data.enrollmentId ?? '—'}</td></tr>
        <tr><td>Issued On</td><td>${data.issuedAt.toLocaleDateString('en-IN', { dateStyle: 'long' })}</td></tr>
        <tr><td>Due Date</td><td><strong>${data.dueAt.toLocaleDateString('en-IN', { dateStyle: 'long' })}</strong></td></tr>
        <tr><td>Status</td><td><span class="status-badge status-active">Active</span></td></tr>
      </table>
      <p>If you did not collect this book, please contact the librarian immediately.</p>
    `),
  };
}

export function dueReminderEmail(data: {
  name: string;
  bookTitle: string;
  dueAt: Date;
  daysLeft: number;
}): { subject: string; html: string } {
  return {
    subject: `Reminder: "${data.bookTitle}" due in ${data.daysLeft} day(s)`,
    html: baseLayout(`
      <p>Dear ${data.name},</p>
      <p>This is a reminder that the following book is due for return <strong>in ${data.daysLeft} day(s)</strong>.</p>
      <table class="detail-table">
        <tr><td>Title</td><td>${data.bookTitle}</td></tr>
        <tr><td>Due Date</td><td><strong>${data.dueAt.toLocaleDateString('en-IN', { dateStyle: 'long' })}</strong></td></tr>
      </table>
      <p>Please return the book to the library counter before the due date. You may also request a renewal at the library counter if eligible.</p>
    `),
  };
}

export function overdueAlertEmail(data: {
  name: string;
  bookTitle: string;
  dueAt: Date;
  ratePerDay: number;
}): { subject: string; html: string } {
  return {
    subject: `Overdue Notice: "${data.bookTitle}" — Fine Accruing`,
    html: baseLayout(`
      <p>Dear ${data.name},</p>
      <p>The following book is <strong>overdue</strong>. A fine of <strong>&#x20B9;${data.ratePerDay.toFixed(2)} per day</strong> is accruing from the due date.</p>
      <table class="detail-table">
        <tr><td>Title</td><td>${data.bookTitle}</td></tr>
        <tr><td>Due Date</td><td>${data.dueAt.toLocaleDateString('en-IN', { dateStyle: 'long' })}</td></tr>
        <tr><td>Fine Rate</td><td>&#x20B9;${data.ratePerDay.toFixed(2)} / day</td></tr>
        <tr><td>Status</td><td><span class="status-badge status-overdue">Overdue</span></td></tr>
      </table>
      <p>Please return the book immediately and settle your dues at the library counter. Continued non-return may result in suspension of borrowing privileges.</p>
    `),
  };
}

export function reservationReadyEmail(data: {
  name: string;
  bookTitle: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  return {
    subject: `Your Reserved Book Is Available: ${data.bookTitle}`,
    html: baseLayout(`
      <p>Dear ${data.name},</p>
      <p>A copy of the book you reserved is now available for collection at the library counter.</p>
      <table class="detail-table">
        <tr><td>Title</td><td>${data.bookTitle}</td></tr>
        <tr><td>Collect By</td><td><strong>${data.expiresAt.toLocaleDateString('en-IN', { dateStyle: 'long' })}</strong></td></tr>
      </table>
      <p>If you do not collect the book by the above date, your reservation will be automatically cancelled and the book will be made available to others.</p>
    `),
  };
}
