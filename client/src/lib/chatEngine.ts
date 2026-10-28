import api from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'STUDENT' | 'LIBRARIAN' | 'SYSTEM_ADMIN';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  table?: { headers: string[]; rows: string[][] };
  timestamp: Date;
}

interface IntentDef {
  id: string;
  keywords: string[];
  roles: UserRole[] | 'ALL';
  entityPattern?: RegExp;
  handler: (entity: string | null, ctx: ChatContext) => Promise<BotResponse>;
}

interface BotResponse {
  text: string;
  table?: { headers: string[]; rows: string[][] };
}

interface ChatContext {
  role: UserRole;
  lastResult?: any;
  lastIntent?: string;
}

// ─── Context (session memory) ─────────────────────────────────────────────────

let context: ChatContext = { role: 'STUDENT' };

export function initContext(role: UserRole) {
  context = { role, lastResult: undefined, lastIntent: undefined };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtCur(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(n);
}

function truncate(s: string, max = 30) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ─── Intent Handlers ──────────────────────────────────────────────────────────

async function handleMyBooks(): Promise<BotResponse> {
  const { data } = await api.get('/issues/me?status=ACTIVE&limit=20');
  const issues = data.data;
  context.lastResult = issues;
  context.lastIntent = 'my_books';

  if (!issues || issues.length === 0) {
    return { text: "You don't have any books issued right now." };
  }

  return {
    text: `You currently have **${issues.length}** book(s) issued:`,
    table: {
      headers: ['#', 'Title', 'Due Date', 'Status'],
      rows: issues.map((i: any, idx: number) => [
        String(idx + 1),
        truncate(i.copy.book.title),
        fmtDate(i.dueAt),
        i.status,
      ]),
    },
  };
}

async function handleDueDates(): Promise<BotResponse> {
  const { data } = await api.get('/issues/me?status=ACTIVE&limit=20');
  const issues = data.data;
  context.lastResult = issues;
  context.lastIntent = 'due_dates';

  if (!issues || issues.length === 0) {
    return { text: 'No active issues found — nothing is due!' };
  }

  const sorted = [...issues].sort(
    (a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );

  return {
    text: 'Here are your upcoming due dates:',
    table: {
      headers: ['Title', 'Due Date', 'Days Left'],
      rows: sorted.map((i: any) => {
        const days = Math.ceil(
          (new Date(i.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return [
          truncate(i.copy.book.title),
          fmtDate(i.dueAt),
          days <= 0 ? `⚠️ OVERDUE` : `${days} day(s)`,
        ];
      }),
    },
  };
}

async function handleMyFines(): Promise<BotResponse> {
  const { data } = await api.get('/fines/me/summary');
  context.lastIntent = 'my_fines';

  if (data.unpaidCount === 0 && data.totalCount === 0) {
    return { text: '🎉 You have no fines at all. Keep it up!' };
  }

  if (data.unpaidCount === 0) {
    return {
      text: `All clear! You have **${data.totalCount}** fine(s) on record, all settled. Total: ${fmtCur(data.totalAmount)}.`,
    };
  }

  return {
    text: `⚠️ You have **${data.unpaidCount}** unpaid fine(s) totalling **${fmtCur(data.unpaidAmount)}**.\n\nPlease settle your dues at the library counter.`,
  };
}

async function handleSearchBook(entity: string | null): Promise<BotResponse> {
  if (!entity || entity.trim().length < 2) {
    return { text: 'Please specify a book title or keyword to search. Example: *search Clean Code*' };
  }

  const { data } = await api.get(`/catalog/books?q=${encodeURIComponent(entity.trim())}&limit=8`);
  const books = data.data;
  context.lastResult = books;
  context.lastIntent = 'search_book';

  if (!books || books.length === 0) {
    return { text: `No books found matching "${entity}". Try a different keyword.` };
  }

  return {
    text: `Found **${data.meta.total}** result(s) for "${entity}":`,
    table: {
      headers: ['Title', 'Author', 'Available'],
      rows: books.map((b: any) => {
        const avail = b.copies
          ? b.copies.filter((c: any) => c.status === 'AVAILABLE').length
          : b._count?.copies ?? '—';
        return [truncate(b.title), b.authors?.[0] ?? '—', String(avail)];
      }),
    },
  };
}

async function handleRenewBook(entity: string | null): Promise<BotResponse> {
  // First get user's active issues to find the book
  const { data } = await api.get('/issues/me?status=ACTIVE&limit=20');
  const issues = data.data;

  if (!issues || issues.length === 0) {
    return { text: "You don't have any active issues to renew." };
  }

  // If no entity, show list and ask which one
  if (!entity || entity.trim().length < 2) {
    context.lastResult = issues;
    context.lastIntent = 'renew_book';
    return {
      text: 'Which book would you like to renew? Here are your active issues:',
      table: {
        headers: ['#', 'Title', 'Due Date'],
        rows: issues.map((i: any, idx: number) => [
          String(idx + 1),
          truncate(i.copy.book.title),
          fmtDate(i.dueAt),
        ]),
      },
    };
  }

  // Try to match by title substring
  const query = entity.trim().toLowerCase();
  const match = issues.find((i: any) =>
    i.copy.book.title.toLowerCase().includes(query)
  );

  if (!match) {
    return {
      text: `I couldn't find an active issue matching "${entity}". Check your books with "my books" and try again.`,
    };
  }

  try {
    await api.post(`/issues/${match.id}/renew`);
    return {
      text: `✅ Successfully renewed "**${match.copy.book.title}**". Your new due date will be reflected shortly.`,
    };
  } catch (err: any) {
    const msg = err.response?.data?.message ?? 'Renewal failed.';
    return { text: `❌ Could not renew "${match.copy.book.title}": ${msg}` };
  }
}

async function handleOverdueList(): Promise<BotResponse> {
  const { data } = await api.get('/issues?status=OVERDUE&limit=15');
  const issues = data.data;
  context.lastResult = issues;
  context.lastIntent = 'overdue_list';

  if (!issues || issues.length === 0) {
    return { text: '🎉 No overdue books at the moment!' };
  }

  return {
    text: `There are **${data.meta.total}** overdue issue(s):`,
    table: {
      headers: ['Title', 'Borrower', 'Due Date'],
      rows: issues.map((i: any) => [
        truncate(i.copy?.book?.title ?? '—'),
        i.issuedTo?.name ?? '—',
        fmtDate(i.dueAt),
      ]),
    },
  };
}

async function handleDashboardStats(): Promise<BotResponse> {
  const { data } = await api.get('/users/dashboard/stats');
  context.lastIntent = 'dashboard_stats';

  return {
    text: '📊 **Library Dashboard Stats**',
    table: {
      headers: ['Metric', 'Value'],
      rows: [
        ['Issued Today', String(data.issuedToday)],
        ['Active Issues', String(data.activeIssues)],
        ['Overdue Issues', String(data.overdueIssues)],
        ['Due Today', String(data.dueTodayIssues)],
        ['Pending Reservations', String(data.pendingReservations)],
        ['Unpaid Fines', fmtCur(data.unpaidFinesTotal)],
        ['Total Books', String(data.totalBooks)],
        ['Active Students', String(data.totalStudents)],
      ],
    },
  };
}

async function handleAllFines(): Promise<BotResponse> {
  const { data } = await api.get('/fines?status=UNPAID&limit=15');
  const fines = data.data;
  context.lastResult = fines;
  context.lastIntent = 'all_fines';

  if (!fines || fines.length === 0) {
    return { text: '🎉 No unpaid fines in the system!' };
  }

  return {
    text: `There are **${data.meta.total}** unpaid fine(s):`,
    table: {
      headers: ['Student', 'Book', 'Amount', 'Reason'],
      rows: fines.map((f: any) => [
        f.user?.name ?? '—',
        truncate(f.issue?.copy?.book?.title ?? '—'),
        fmtCur(Number(f.amount)),
        f.reason.replace('_', ' '),
      ]),
    },
  };
}

async function handleHelp(_e: string | null, ctx: ChatContext): Promise<BotResponse> {
  const isStudent = ctx.role === 'STUDENT';
  const lines = [
    "Here's what I can help you with:\n",
    '• **"my books"** — See your currently issued books',
    '• **"due dates"** — Check when your books are due',
    '• **"my fines"** — View your fine summary',
    '• **"search [title]"** — Search the catalog',
    '• **"renew [title]"** — Renew an active issue',
  ];

  if (!isStudent) {
    lines.push(
      '',
      '📋 **Librarian commands:**',
      '• **"overdue"** — List all overdue books',
      '• **"stats"** — Dashboard statistics',
      '• **"all fines"** — List unpaid fines'
    );
  }

  lines.push('\nJust type naturally — I\'ll understand! 😊');
  return { text: lines.join('\n') };
}

// ─── Intent Definitions ───────────────────────────────────────────────────────

const intents: IntentDef[] = [
  {
    id: 'help',
    keywords: ['help', 'what can you do', 'commands', 'how to use', 'guide'],
    roles: 'ALL',
    handler: handleHelp,
  },
  {
    id: 'my_books',
    keywords: ['my books', 'issued books', 'borrowed', 'my issued', 'what books', 'current books'],
    roles: ['STUDENT'],
    handler: handleMyBooks,
  },
  {
    id: 'due_dates',
    keywords: ['due date', 'when due', 'deadline', 'when is', 'due soon', 'when return'],
    roles: ['STUDENT'],
    handler: handleDueDates,
  },
  {
    id: 'my_fines',
    keywords: ['my fine', 'my fines', 'penalty', 'dues', 'how much fine', 'do i have fine', 'pending fine'],
    roles: ['STUDENT'],
    handler: handleMyFines,
  },
  {
    id: 'search_book',
    keywords: ['search', 'find', 'find book', 'is there', 'look for', 'book called', 'available'],
    roles: 'ALL',
    entityPattern: /(?:search|find|look for|is there|book called|available)\s+['"]?(.+?)['"]?\s*\??$/i,
    handler: handleSearchBook,
  },
  {
    id: 'renew_book',
    keywords: ['renew'],
    roles: 'ALL',
    entityPattern: /renew\s+['"]?(.+?)['"]?\s*\??$/i,
    handler: handleRenewBook,
  },
  {
    id: 'overdue_list',
    keywords: ['overdue', 'overdue list', 'overdue books', 'late books', 'show overdue'],
    roles: ['LIBRARIAN', 'SYSTEM_ADMIN'],
    handler: handleOverdueList,
  },
  {
    id: 'dashboard_stats',
    keywords: ['stats', 'statistics', 'dashboard', 'summary', 'how many books', 'total books', 'library stats'],
    roles: ['LIBRARIAN', 'SYSTEM_ADMIN'],
    handler: handleDashboardStats,
  },
  {
    id: 'all_fines',
    keywords: ['all fines', 'fines list', 'unpaid fines', 'show fines', 'list fines'],
    roles: ['LIBRARIAN', 'SYSTEM_ADMIN'],
    handler: handleAllFines,
  },
];

// ─── Intent Matching ──────────────────────────────────────────────────────────

function matchIntent(input: string): { intent: IntentDef; entity: string | null } | null {
  const lower = input.toLowerCase().trim();

  // Score each intent by how well its keywords match
  let bestMatch: IntentDef | null = null;
  let bestScore = 0;
  let bestEntity: string | null = null;

  for (const intent of intents) {
    // Check role access
    if (intent.roles !== 'ALL' && !intent.roles.includes(context.role)) continue;

    for (const kw of intent.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        const score = kw.length; // Longer keyword = more specific = higher priority
        if (score > bestScore) {
          bestScore = score;
          bestMatch = intent;
        }
      }
    }
  }

  if (bestMatch) {
    // Extract entity if pattern exists
    if (bestMatch.entityPattern) {
      const m = input.match(bestMatch.entityPattern);
      bestEntity = m?.[1] ?? null;
    }
    return { intent: bestMatch, entity: bestEntity };
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function processMessage(input: string): Promise<BotResponse> {
  const matched = matchIntent(input);

  if (!matched) {
    // Fallback
    const isStudent = context.role === 'STUDENT';
    return {
      text: `I'm not sure what you mean. Try:\n\n${
        isStudent
          ? '• "my books"\n• "due dates"\n• "my fines"\n• "search [title]"\n• "renew [title]"'
          : '• "overdue"\n• "stats"\n• "all fines"\n• "search [title]"'
      }\n\nType **"help"** for all available commands.`,
    };
  }

  try {
    return await matched.intent.handler(matched.entity, context);
  } catch (err: any) {
    console.error('[Chatbot Error]', err);
    const status = err.response?.status;
    if (status === 401) {
      return { text: '🔒 Your session has expired. Please log in again.' };
    }
    if (status === 403) {
      return { text: '🚫 You don\'t have permission for that action.' };
    }
    return { text: 'Something went wrong while processing your request. Please try again.' };
  }
}

export function getQuickActions(role: UserRole): { label: string; query: string }[] {
  if (role === 'STUDENT') {
    return [
      { label: '📚 My Books', query: 'my books' },
      { label: '💰 My Fines', query: 'my fines' },
      { label: '🔍 Search Catalog', query: 'search ' },
      { label: '📅 Due Dates', query: 'due dates' },
    ];
  }
  return [
    { label: '⚠️ Overdue', query: 'overdue list' },
    { label: '📊 Stats', query: 'stats' },
    { label: '💰 Unpaid Fines', query: 'all fines' },
    { label: '🔍 Search', query: 'search ' },
  ];
}
