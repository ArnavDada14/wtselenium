import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

interface Renewal { id: string; }

interface Issue {
  id: string;
  issuedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: string;
  copy: {
    barcode: string;
    book: {
      title: string;
      authors: string[];
      isbn: string;
      category?: { maxRenewals: number };
    };
  };
  renewals: Renewal[];
}

interface Fine {
  id: string;
  amount: string;
  status: string;
  reason: string;
  createdAt: string;
  issue: { copy: { book: { title: string } } };
}

interface Summary { unpaidCount: number; unpaidAmount: number; }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtCur(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
}

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'status-active', OVERDUE: 'status-overdue', RETURNED: 'status-returned',
  UNPAID: 'status-overdue', PAID: 'status-returned', WAIVED: 'status-info',
};

interface Toast { id: number; msg: string; type: 'success' | 'error'; }

export default function StudentPortalPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'issues' | 'fines'>('issues');
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (msg: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, f, s] = await Promise.all([
        api.get('/issues/me?limit=50'),
        api.get('/fines/me?limit=50'),
        api.get('/fines/me/summary'),
      ]);
      setIssues(i.data.data);
      setFines(f.data.data);
      setSummary(s.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRenew(issue: Issue) {
    setRenewingId(issue.id);
    try {
      const { data } = await api.post(`/issues/${issue.id}/renew`);
      // Update the due date in-place
      setIssues(prev => prev.map(iss =>
        iss.id === issue.id
          ? { ...iss, dueAt: data.newDueAt, renewals: [...iss.renewals, { id: 'new' }] }
          : iss
      ));
      addToast(`Renewed! New due date: ${fmtDate(data.newDueAt)}`, 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Renewal failed. Please try again.';
      addToast(msg, 'error');
    } finally {
      setRenewingId(null);
    }
  }

  const MAX_RENEWALS_FALLBACK = 2; // fallback if category not loaded

  return (
    <div className="page">
      {/* Toast notifications */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              background: t.type === 'success' ? 'var(--color-success, #1a5c2e)' : 'var(--color-error, #8b1a1a)',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              maxWidth: 320,
              animation: 'slideIn 0.2s ease',
            }}
          >
            {t.type === 'success' ? '✓ ' : '✕ '}{t.msg}
          </div>
        ))}
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">My Library</div>
          <div className="page-breadcrumb">Student Portal — Issued Books &amp; Fines</div>
        </div>
      </div>

      {summary && summary.unpaidCount > 0 && (
        <div className="notice notice-warn" style={{ marginBottom: 20 }}>
          You have <strong>{summary.unpaidCount}</strong> unpaid fine(s) totalling <strong>{fmtCur(summary.unpaidAmount)}</strong>.{' '}
          Please settle dues at the library counter before borrowing additional books.
        </div>
      )}

      {/* Tab headers */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
        {(['issues', 'fines'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: tab === t ? 'var(--color-accent)' : 'var(--color-text-sec)',
              background: 'none',
              border: 'none',
              borderBottomWidth: 2,
              borderBottomStyle: 'solid',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t === 'issues' ? 'Issued Books' : 'Fines'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : tab === 'issues' ? (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>ISBN</th>
                <th>Issued</th>
                <th>Due Date</th>
                <th>Returned</th>
                <th>Status</th>
                <th>Renewals</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-ter)' }}>No books issued</td></tr>
              ) : issues.map(issue => {
                const renewalCount = issue.renewals?.length ?? 0;
                const maxRenewals = issue.copy?.book?.category?.maxRenewals ?? MAX_RENEWALS_FALLBACK;
                const canRenew = (issue.status === 'ACTIVE' || issue.status === 'OVERDUE') && renewalCount < maxRenewals;
                const isRenewing = renewingId === issue.id;

                return (
                  <tr key={issue.id} style={isRenewing ? { opacity: 0.7 } : {}}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{issue.copy.book.title}</div>
                      <div className="dim">{issue.copy.book.authors[0]}</div>
                    </td>
                    <td><span className="mono">{issue.copy.book.isbn}</span></td>
                    <td className="dim">{fmtDate(issue.issuedAt)}</td>
                    <td style={{
                      fontWeight: issue.status === 'OVERDUE' ? 700 : 400,
                      color: issue.status === 'OVERDUE' ? 'var(--color-overdue)' : 'inherit',
                    }}>
                      {fmtDate(issue.dueAt)}
                    </td>
                    <td className="dim">{issue.returnedAt ? fmtDate(issue.returnedAt) : '—'}</td>
                    <td>
                      <span className={`status ${STATUS_CLASS[issue.status] ?? ''}`}>
                        {issue.status === 'OVERDUE' ? '▲ ' : ''}{issue.status}
                      </span>
                    </td>
                    <td>
                      {issue.status !== 'RETURNED' ? (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: renewalCount >= maxRenewals ? 'var(--color-text-ter)' : 'var(--color-text-sec)',
                          fontFamily: 'monospace',
                        }}>
                          {renewalCount} / {maxRenewals}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {canRenew && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '4px 12px', whiteSpace: 'nowrap' }}
                          disabled={isRenewing}
                          onClick={() => handleRenew(issue)}
                        >
                          {isRenewing ? 'Renewing…' : '↻ Renew'}
                        </button>
                      )}
                      {issue.status !== 'RETURNED' && renewalCount >= maxRenewals && (
                        <span style={{ fontSize: 11, color: 'var(--color-text-ter)' }}>Max renewals</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Reason</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fines.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-ter)' }}>No fines on record</td></tr>
              ) : fines.map(fine => (
                <tr key={fine.id}>
                  <td style={{ fontWeight: 500 }}>{fine.issue.copy.book.title}</td>
                  <td><span className="tag">{fine.reason.replace('_', ' ')}</span></td>
                  <td style={{ fontWeight: 700 }}>{fmtCur(Number(fine.amount))}</td>
                  <td className="dim">{fmtDate(fine.createdAt)}</td>
                  <td>
                    <span className={`status ${STATUS_CLASS[fine.status] ?? ''}`}>{fine.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
