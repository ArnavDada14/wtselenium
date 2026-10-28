import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  enrollmentId: string | null;
  department: string | null;
  isActive: boolean;
  createdAt: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ROLE_CLASS: Record<string, string> = {
  STUDENT: '',
  LIBRARIAN: 'status-info',
  SYSTEM_ADMIN: 'status-pending',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'create' | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STUDENT', enrollmentId: '', department: '' });
  const [formErr, setFormErr] = useState('');
  const [creating, setCreating] = useState(false);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set('q', q);
      if (roleFilter) params.set('role', roleFilter);
      const { data } = await api.get(`/users?${params}`);
      setUsers(data.data);
      setTotal(data.meta.total);
    } finally { setLoading(false); }
  }, [q, roleFilter, page]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function toggleActive(user: User) {
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to update user.');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormErr('');
    setCreating(true);
    try {
      await api.post('/users', form);
      setModal(null);
      setForm({ name: '', email: '', password: '', role: 'STUDENT', enrollmentId: '', department: '' });
      load();
    } catch (err: any) {
      setFormErr(err?.response?.data?.message ?? 'Failed to create user.');
    } finally { setCreating(false); }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Users</div>
          <div className="page-breadcrumb">Administration — Students, Librarians &amp; Admins</div>
        </div>
        <button className="btn btn-primary" id="create-user-btn" onClick={() => setModal('create')}>+ Add User</button>
      </div>

      <div className="filters-bar">
        <input
          id="users-search"
          className="filter-input"
          style={{ minWidth: 280 }}
          placeholder="Search name, email, enrollment ID..."
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
        />
        <select
          id="users-role-filter"
          className="filter-select"
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Roles</option>
          <option value="STUDENT">Students</option>
          <option value="LIBRARIAN">Librarians</option>
          <option value="SYSTEM_ADMIN">Admins</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Enrollment ID</th>
              <th>Department</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="loading-row"><td colSpan={8}>Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-ter)' }}>No users found</td></tr>
            ) : users.map(user => (
              <tr key={user.id}>
                <td style={{ fontWeight: 500 }}>{user.name}</td>
                <td className="dim">{user.email}</td>
                <td><span className="mono">{user.enrollmentId ?? '—'}</span></td>
                <td className="dim">{user.department ?? '—'}</td>
                <td>
                  <span className={`status ${ROLE_CLASS[user.role] ?? ''}`}>
                    {user.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="dim">{fmtDate(user.createdAt)}</td>
                <td>
                  <span className={`status ${user.isActive ? 'status-active' : 'status-overdue'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button
                    className={`btn btn-sm ${user.isActive ? 'btn-ghost' : 'btn-secondary'}`}
                    onClick={() => toggleActive(user)}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="pagination-info">{total} users</span>
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span style={{ fontSize: 12, color: 'var(--color-text-sec)' }}>{page} / {totalPages || 1}</span>
        <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>

      {/* Create User Modal */}
      {modal === 'create' && (
        <div className="modal-overlay" onClick={() => !creating && setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add User</div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {formErr && <div className="notice notice-error" style={{ marginBottom: 14 }}>{formErr}</div>}
                <div className="form-grid">
                  <div className="form-row">
                    <div className="form-field">
                      <label className="form-label">Full Name *</label>
                      <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Rahul Mehta" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Role *</label>
                      <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                        <option value="STUDENT">Student</option>
                        <option value="LIBRARIAN">Librarian</option>
                        <option value="SYSTEM_ADMIN">System Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Email Address *</label>
                    <input className="form-input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@college.edu" />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Password *</label>
                    <input className="form-input" type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 8 characters" />
                  </div>
                  {form.role === 'STUDENT' && (
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">Enrollment ID</label>
                        <input className="form-input" value={form.enrollmentId} onChange={e => setForm(f => ({ ...f, enrollmentId: e.target.value }))} placeholder="e.g. CS22-042" />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Department</label>
                        <input className="form-input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Computer Science" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)} disabled={creating}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
