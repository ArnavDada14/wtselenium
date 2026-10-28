import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

interface Fine {
  id: string;
  amount: string;
  reason: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  waivedAt: string | null;
  waiverNote: string | null;
  user: { id: string; name: string; enrollmentId: string };
  issue: {
    id: string;
    dueAt: string;
    copy: { book: { title: string; isbn: string } };
  };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtCur(n: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n));
}

const STATUS_CLASS: Record<string, string> = {
  UNPAID: 'status-overdue',
  PAID: 'status-returned',
  WAIVED: 'status-info',
};

export default function FinesPage() {
  const [fines, setFines] = useState<Fine[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('UNPAID');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: 'pay' | 'waive'; fine: Fine } | null>(null);
  const [waiveNote, setWaiveNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionErr, setActionErr] = useState('');
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/fines?${params}`);
      setFines(data.data);
      setTotal(data.meta.total);
    } finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleAction() {
    if (!modal) return;
    setProcessing(true);
    setActionErr('');
    try {
      if (modal.type === 'pay') {
        await api.post(`/fines/${modal.fine.id}/pay`);
      } else {
        await api.post(`/fines/${modal.fine.id}/waive`, { note: waiveNote });
      }
      setModal(null);
      setWaiveNote('');
      load();
    } catch (err: any) {
      setActionErr(err?.response?.data?.message ?? 'Action failed.');
    } finally { setProcessing(false); }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Fines</div>
          <div className="page-breadcrumb">Finance — Outstanding and Settled Fines</div>
        </div>
      </div>

      <div className="filters-bar">
        <select
          id="fines-status-filter"
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PAID">Paid</option>
          <option value="WAIVED">Waived</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Enrollment ID</th>
              <th>Book</th>
              <th>Reason</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="loading-row"><td colSpan={8}>Loading...</td></tr>
            ) : fines.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-ter)' }}>No fines found</td></tr>
            ) : fines.map(fine => (
              <tr key={fine.id}>
                <td style={{ fontWeight: 500 }}>{fine.user.name}</td>
                <td><span className="mono">{fine.user.enrollmentId ?? '—'}</span></td>
                <td style={{ maxWidth: 200 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fine.issue.copy.book.title}
                  </div>
                  <div className="dim">{fine.issue.copy.book.isbn}</div>
                </td>
                <td><span className="tag">{fine.reason.replace('_', ' ')}</span></td>
                <td style={{ fontWeight: 700 }}>{fmtCur(fine.amount)}</td>
                <td className="dim">{fmtDate(fine.createdAt)}</td>
                <td>
                  <span className={`status ${STATUS_CLASS[fine.status] ?? ''}`}>{fine.status}</span>
                </td>
                <td>
                  {fine.status === 'UNPAID' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'pay', fine })}>Pay</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setModal({ type: 'waive', fine }); setWaiveNote(''); }}>Waive</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="pagination-info">{total} records</span>
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span style={{ fontSize: 12, color: 'var(--color-text-sec)' }}>{page} / {totalPages || 1}</span>
        <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => !processing && setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal.type === 'pay' ? 'Record Payment' : 'Waive Fine'}</div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {actionErr && <div className="notice notice-error" style={{ marginBottom: 14 }}>{actionErr}</div>}
              <p style={{ fontSize: 13, marginBottom: 16 }}>
                {modal.type === 'pay'
                  ? `Mark fine of ${fmtCur(modal.fine.amount)} as paid for ${modal.fine.user.name}?`
                  : `Waive fine of ${fmtCur(modal.fine.amount)} for ${modal.fine.user.name}.`}
              </p>
              {modal.type === 'waive' && (
                <div className="form-field">
                  <label className="form-label">Reason for Waiver *</label>
                  <textarea
                    className="form-textarea"
                    value={waiveNote}
                    onChange={e => setWaiveNote(e.target.value)}
                    placeholder="Provide a justification for the waiver (required)"
                    rows={3}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)} disabled={processing}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleAction}
                disabled={processing || (modal.type === 'waive' && !waiveNote.trim())}
              >
                {processing ? 'Processing...' : modal.type === 'pay' ? 'Confirm Payment' : 'Waive Fine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
