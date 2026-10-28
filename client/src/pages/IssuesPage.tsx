import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';

interface Issue {
  id: string;
  issuedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: string;
  copy: {
    barcode: string;
    book: { title: string; isbn: string; authors: string[] };
  };
  issuedTo: { id: string; name: string; enrollmentId: string };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'status-active',
  OVERDUE: 'status-overdue',
  RETURNED: 'status-returned',
  LOST: 'status-overdue',
};

interface ReturnModal {
  issue: Issue;
}

export default function IssuesPage() {
  const [searchParams] = useSearchParams();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'ACTIVE');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [returning, setReturning] = useState<Issue | null>(null);
  const [returnResult, setReturnResult] = useState<any>(null);
  const [returnErr, setReturnErr] = useState('');
  const [processing, setProcessing] = useState(false);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/issues?${params}`);
      setIssues(data.data);
      setTotal(data.meta.total);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleReturn(issue: Issue) {
    setReturning(issue);
    setReturnResult(null);
    setReturnErr('');
  }

  async function confirmReturn() {
    if (!returning) return;
    setProcessing(true);
    setReturnErr('');
    try {
      const { data } = await api.post(`/issues/${returning.id}/return`);
      setReturnResult(data);
      load();
    } catch (err: any) {
      setReturnErr(err?.response?.data?.message ?? 'Return failed.');
    } finally {
      setProcessing(false);
    }
  }

  const filtered = search
    ? issues.filter(i =>
        i.copy.book.title.toLowerCase().includes(search.toLowerCase()) ||
        i.issuedTo.enrollmentId?.toLowerCase().includes(search.toLowerCase()) ||
        i.copy.barcode.toLowerCase().includes(search.toLowerCase())
      )
    : issues;

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Issues</div>
          <div className="page-breadcrumb">Circulation — Active &amp; Historical Issues</div>
        </div>
        <Link to="/issue" className="btn btn-primary">+ Issue Book</Link>
      </div>

      <div className="filters-bar">
        <input
          id="issues-search"
          className="filter-input"
          placeholder="Search by title, barcode, enrollment ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <select
          id="issues-status-filter"
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="OVERDUE">Overdue</option>
          <option value="RETURNED">Returned</option>
          <option value="LOST">Lost</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Title</th>
              <th>Student</th>
              <th>Enrollment ID</th>
              <th>Issued</th>
              <th>Due Date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="loading-row"><td colSpan={8}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-ter)' }}>No issues found</td></tr>
            ) : filtered.map(issue => (
              <tr key={issue.id}>
                <td><span className="mono">{issue.copy.barcode.slice(0, 18)}...</span></td>
                <td style={{ maxWidth: 220 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {issue.copy.book.title}
                  </div>
                  <div className="dim">{issue.copy.book.authors[0]}</div>
                </td>
                <td>{issue.issuedTo.name}</td>
                <td><span className="mono">{issue.issuedTo.enrollmentId ?? '—'}</span></td>
                <td className="dim">{fmtDate(issue.issuedAt)}</td>
                <td style={{ fontWeight: issue.status === 'OVERDUE' ? 700 : 400, color: issue.status === 'OVERDUE' ? 'var(--color-overdue)' : 'inherit' }}>
                  {fmtDate(issue.dueAt)}
                </td>
                <td>
                  <span className={`status ${STATUS_CLASS[issue.status] ?? ''}`}>
                    {issue.status === 'OVERDUE' ? '▲ ' : ''}{issue.status}
                  </span>
                </td>
                <td>
                  {(issue.status === 'ACTIVE' || issue.status === 'OVERDUE') && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleReturn(issue)}
                    >
                      Return
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <span className="pagination-info">{total} total records</span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => setPage(p => p - 1)}
        >Prev</button>
        <span style={{ fontSize: 12, color: 'var(--color-text-sec)' }}>{page} / {totalPages || 1}</span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page >= totalPages}
          onClick={() => setPage(p => p + 1)}
        >Next</button>
      </div>

      {/* Return Modal */}
      {returning && (
        <div className="modal-overlay" onClick={() => !processing && !returnResult && setReturning(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Return Book</div>
              <button className="modal-close" onClick={() => setReturning(null)}>×</button>
            </div>
            <div className="modal-body">
              {returnResult ? (
                <>
                  <div className="notice notice-success" style={{ marginBottom: 16 }}>
                    Book returned successfully.
                  </div>
                  {returnResult.fine ? (
                    <div className="notice notice-warn">
                      Fine applied: <strong>&#x20B9;{Number(returnResult.fine.amount).toFixed(2)}</strong> (overdue)
                    </div>
                  ) : (
                    <div className="notice notice-info">No fine applicable.</div>
                  )}
                </>
              ) : (
                <>
                  {returnErr && <div className="notice notice-error" style={{ marginBottom: 14 }}>{returnErr}</div>}
                  <p style={{ fontSize: 13, marginBottom: 16 }}>Confirm return of the following book:</p>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <tbody>
                        <tr><td style={{ width: '40%', color: 'var(--color-text-sec)' }}>Title</td><td style={{ fontWeight: 600 }}>{returning.copy.book.title}</td></tr>
                        <tr><td style={{ color: 'var(--color-text-sec)' }}>Student</td><td>{returning.issuedTo.name}</td></tr>
                        <tr><td style={{ color: 'var(--color-text-sec)' }}>Due Date</td><td>{fmtDate(returning.dueAt)}</td></tr>
                        <tr><td style={{ color: 'var(--color-text-sec)' }}>Status</td>
                          <td><span className={`status ${STATUS_CLASS[returning.status]}`}>{returning.status}</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {returning.status === 'OVERDUE' && (
                    <div className="notice notice-warn" style={{ marginTop: 14 }}>
                      This book is overdue. A fine will be calculated and applied upon return.
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              {returnResult ? (
                <button className="btn btn-primary" onClick={() => setReturning(null)}>Done</button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setReturning(null)} disabled={processing}>Cancel</button>
                  <button className="btn btn-primary" onClick={confirmReturn} disabled={processing}>
                    {processing ? 'Processing...' : 'Confirm Return'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
