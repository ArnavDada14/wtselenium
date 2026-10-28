import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

interface LogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
  actor: { id: string; name: string; role: string };
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

const ACTION_COLOR: Record<string, string> = {
  'book.issue':  'var(--color-active)',
  'book.return': 'var(--color-info)',
  'fine.pay':    'var(--color-text-sec)',
  'fine.waive':  'var(--color-pending)',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The audit log reads directly from the DB — we expose a simple admin endpoint
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      const { data } = await api.get(`/users/audit?${params}`);
      setLogs(data.data ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch {
      // Endpoint may not exist yet — show empty gracefully
      setLogs([]);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-breadcrumb">Administration — Full Immutable Action Log</div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="loading-row"><td colSpan={6}>Loading audit log...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-ter)' }}>
                No audit entries found
              </td></tr>
            ) : logs.map(log => (
              <tr key={log.id}>
                <td className="dim" style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {fmtDateTime(log.timestamp)}
                </td>
                <td>
                  <div style={{ fontWeight: 500, fontSize: 12 }}>{log.actor.name}</div>
                  <div className="dim">{log.actor.role.replace('_', ' ')}</div>
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: ACTION_COLOR[log.action] ?? 'var(--color-text-pri)' }}>
                    {log.action}
                  </span>
                </td>
                <td><span className="tag">{log.entityType}</span></td>
                <td><span className="mono">{log.entityId.slice(0, 16)}...</span></td>
                <td>
                  {log.metadata ? (
                    <code style={{ fontSize: 11, color: 'var(--color-text-sec)', fontFamily: 'var(--font-mono)' }}>
                      {JSON.stringify(log.metadata).slice(0, 60)}
                      {JSON.stringify(log.metadata).length > 60 ? '…' : ''}
                    </code>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="pagination-info">{total} entries</span>
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span style={{ fontSize: 12, color: 'var(--color-text-sec)' }}>{page} / {totalPages}</span>
        <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
}
