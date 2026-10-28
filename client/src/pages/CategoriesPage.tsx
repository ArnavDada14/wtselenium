import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

interface FinePolicy {
  id: string;
  name: string;
  ratePerDay: string;
  gracePeriodDays: number;
  maxFineAmount: string | null;
}

interface Category {
  id: string;
  name: string;
  maxIssueDays: number;
  maxRenewals: number;
  finePolicyId: string | null;
  finePolicy: FinePolicy | null;
  _count: { books: number };
}

const EMPTY_FORM = { name: '', maxIssueDays: 14, maxRenewals: 2, finePolicyId: '' };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [policies, setPolicies] = useState<FinePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, pols] = await Promise.all([
        api.get('/catalog/categories'),
        api.get('/catalog/fine-policies'),
      ]);
      setCategories(cats.data);
      setPolicies(pols.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErr('');
    setModal('create');
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({
      name: cat.name,
      maxIssueDays: cat.maxIssueDays,
      maxRenewals: cat.maxRenewals,
      finePolicyId: cat.finePolicyId ?? '',
    });
    setErr('');
    setModal('edit');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      maxIssueDays: Number(form.maxIssueDays),
      maxRenewals: Number(form.maxRenewals),
      finePolicyId: form.finePolicyId || null,
    };
    try {
      if (modal === 'edit' && editing) {
        await api.patch(`/catalog/categories/${editing.id}`, payload);
      } else {
        await api.post('/catalog/categories', payload);
      }
      setModal(null);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteErr('');
    try {
      await api.delete(`/catalog/categories/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      setDeleteErr(e?.response?.data?.message ?? 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Categories</div>
          <div className="page-breadcrumb">Catalog — Book Categories & Fine Policies</div>
        </div>
        <button id="add-category-btn" className="btn btn-primary" onClick={openCreate}>
          + Add Category
        </button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Category Name</th>
              <th>Issue Period</th>
              <th>Max Renewals</th>
              <th>Fine Policy</th>
              <th>Fine Rate</th>
              <th>Books</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="loading-row"><td colSpan={7}>Loading...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-ter)' }}>
                No categories yet — add one above
              </td></tr>
            ) : categories.map(cat => (
              <tr key={cat.id}>
                <td style={{ fontWeight: 600 }}>{cat.name}</td>
                <td>{cat.maxIssueDays} days</td>
                <td>{cat.maxRenewals === 0 ? <span className="dim">None</span> : cat.maxRenewals}</td>
                <td>
                  {cat.finePolicy
                    ? <span className="tag">{cat.finePolicy.name}</span>
                    : <span className="dim">—</span>}
                </td>
                <td>
                  {cat.finePolicy
                    ? <>₹{Number(cat.finePolicy.ratePerDay).toFixed(2)}/day
                      {cat.finePolicy.gracePeriodDays > 0 && (
                        <span className="dim" style={{ marginLeft: 6, fontSize: 11 }}>
                          ({cat.finePolicy.gracePeriodDays}d grace)
                        </span>
                      )}
                    </>
                    : <span className="dim">—</span>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`status ${cat._count.books > 0 ? 'status-active' : ''}`}>
                    {cat._count.books}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(cat)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-overdue)' }}
                      onClick={() => { setDeleteConfirm(cat); setDeleteErr(''); }}
                      disabled={cat._count.books > 0}
                      title={cat._count.books > 0 ? `${cat._count.books} book(s) assigned — reassign first` : 'Delete category'}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => !saving && setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'edit' ? 'Edit Category' : 'Add Category'}</div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {err && <div className="notice notice-error" style={{ marginBottom: 14 }}>{err}</div>}
                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label">Category Name *</label>
                    <input
                      className="form-input"
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Computer Science"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label className="form-label">Issue Period (days) *</label>
                      <input
                        className="form-input"
                        type="number"
                        min={1}
                        max={180}
                        required
                        value={form.maxIssueDays}
                        onChange={e => setForm(f => ({ ...f, maxIssueDays: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Max Renewals *</label>
                      <input
                        className="form-input"
                        type="number"
                        min={0}
                        max={10}
                        required
                        value={form.maxRenewals}
                        onChange={e => setForm(f => ({ ...f, maxRenewals: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Fine Policy</label>
                    <select
                      className="form-select"
                      value={form.finePolicyId}
                      onChange={e => setForm(f => ({ ...f, finePolicyId: e.target.value }))}
                    >
                      <option value="">— No fine policy —</option>
                      {policies.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ₹{Number(p.ratePerDay).toFixed(2)}/day
                          {p.maxFineAmount ? ` (max ₹${Number(p.maxFineAmount).toFixed(0)})` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="form-hint">Controls overdue fine rate for books in this category.</div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : modal === 'edit' ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Category</div>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              {deleteErr && <div className="notice notice-error" style={{ marginBottom: 14 }}>{deleteErr}</div>}
              <p style={{ fontSize: 14, marginBottom: 0 }}>
                Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>?
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--color-overdue)' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
