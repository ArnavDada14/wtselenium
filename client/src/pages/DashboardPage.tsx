import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

interface Stats {
  issuedToday: number;
  activeIssues: number;
  overdueIssues: number;
  dueTodayIssues: number;
  pendingReservations: number;
  unpaidFinesTotal: number;
  totalBooks: number;
  totalStudents: number;
}

interface RecentIssue {
  id: string;
  issuedAt: string;
  dueAt: string;
  status: string;
  copy: { book: { title: string; isbn: string } };
  issuedTo: { name: string; enrollmentId: string };
}

function fmt(n: number) { return n.toLocaleString('en-IN'); }
function fmtCur(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'status-active',
  OVERDUE: 'status-overdue',
  RETURNED: 'status-returned',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users/dashboard/stats'),
      api.get('/issues?limit=8&page=1'),
    ]).then(([s, i]) => {
      setStats(s.data);
      setRecent(i.data.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state"><p>Loading dashboard...</p></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-breadcrumb">Overview — {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{fmt(stats!.issuedToday)}</div>
          <div className="metric-label">Issued Today</div>
        </div>
        <div className="metric-card">
          <div className="metric-value active">{fmt(stats!.activeIssues)}</div>
          <div className="metric-label">Active Issues</div>
        </div>
        <div className="metric-card">
          <div className="metric-value overdue">{fmt(stats!.overdueIssues)}</div>
          <div className="metric-label">Overdue</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{fmt(stats!.dueTodayIssues)}</div>
          <div className="metric-label">Due Today</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{fmt(stats!.pendingReservations)}</div>
          <div className="metric-label">Reservations Pending</div>
        </div>
        <div className="metric-card">
          <div className="metric-value overdue">{fmtCur(stats!.unpaidFinesTotal)}</div>
          <div className="metric-label">Unpaid Fines Total</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{fmt(stats!.totalBooks)}</div>
          <div className="metric-label">Books in Catalog</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{fmt(stats!.totalStudents)}</div>
          <div className="metric-label">Active Students</div>
        </div>
      </div>

      {/* Recent Issues */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">Recent Issues</div>
          <Link to="/issues" className="btn btn-ghost btn-sm">View All</Link>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Student</th>
                <th>Enrollment ID</th>
                <th>Issued</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-ter)' }}>No recent issues</td></tr>
              ) : recent.map((issue) => (
                <tr key={issue.id}>
                  <td style={{ maxWidth: 240 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {issue.copy.book.title}
                    </div>
                    <div className="dim">{issue.copy.book.isbn}</div>
                  </td>
                  <td>{issue.issuedTo.name}</td>
                  <td><span className="mono">{issue.issuedTo.enrollmentId ?? '—'}</span></td>
                  <td className="dim">{fmtDate(issue.issuedAt)}</td>
                  <td style={{ fontWeight: issue.status === 'OVERDUE' ? 600 : 400 }}>
                    {fmtDate(issue.dueAt)}
                  </td>
                  <td>
                    <span className={`status ${STATUS_CLASS[issue.status] ?? ''}`}>
                      {issue.status === 'OVERDUE' ? '▲ ' : ''}{issue.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
