import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';

interface Copy {
  id: string;
  barcode: string;
  condition: string;
  location: string | null;
  status: string;
  acquiredAt: string;
  notes: string | null;
}

interface Book {
  id: string;
  isbn: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string;
  publishedYear: number;
  edition: string | null;
  language: string;
  pages: number | null;
  description: string | null;
  tags: string[];
  coverUrl: string | null;
  category: {
    id: string;
    name: string;
    maxIssueDays: number;
    finePolicy: { ratePerDay: string; gracePeriodDays: number } | null;
  };
  copies: Copy[];
}

const COND_CLASS: Record<string, string> = {
  NEW: 'status-active',
  GOOD: 'status-active',
  WORN: 'status-pending',
  DAMAGED: 'status-overdue',
};
const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: 'status-available',
  ISSUED: 'status-overdue',
  RESERVED: 'status-pending',
  MAINTENANCE: 'status-pending',
  RETIRED: 'status-returned',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Barcode Image Component ─────────────────────────────────────────────────
function BarcodeImage({ barcode, width = 200 }: { barcode: string; width?: number }) {
  const src = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'}/catalog/copies/barcode/${encodeURIComponent(barcode)}/image`;
  return (
    <img
      src={src}
      alt={`Barcode: ${barcode}`}
      width={width}
      style={{ display: 'block', imageRendering: 'crisp-edges' }}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

// ─── Single Label Print View ─────────────────────────────────────────────────
function PrintLabelModal({
  copies,
  bookTitle,
  isbn,
  onClose,
}: {
  copies: Copy[];
  bookTitle: string;
  isbn: string;
  onClose: () => void;
}) {
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

  function handlePrint() {
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;

    const labelsHtml = copies.map(copy => {
      const imgSrc = `${apiBase}/catalog/copies/barcode/${encodeURIComponent(copy.barcode)}/image`;
      return `
        <div class="label">
          <div class="label-title">${bookTitle.slice(0, 45)}${bookTitle.length > 45 ? '…' : ''}</div>
          <div class="label-isbn">ISBN: ${isbn}</div>
          <img src="${imgSrc}" alt="${copy.barcode}" />
          <div class="label-barcode-text">${copy.barcode}</div>
          <div class="label-meta">
            ${copy.location ? `Shelf: ${copy.location}` : ''}
            &nbsp;&nbsp;Cond: ${copy.condition}
          </div>
        </div>
      `;
    }).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Barcode Labels — ${bookTitle}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Arial', sans-serif;
            background: #fff;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8mm;
          }
          .label {
            border: 1px solid #999;
            padding: 6mm 5mm;
            text-align: center;
            page-break-inside: avoid;
            background: #fff;
          }
          .label-title {
            font-size: 9pt;
            font-weight: bold;
            margin-bottom: 2mm;
            line-height: 1.3;
          }
          .label-isbn {
            font-size: 7pt;
            color: #555;
            margin-bottom: 3mm;
          }
          .label img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto 2mm;
          }
          .label-barcode-text {
            font-family: 'Courier New', monospace;
            font-size: 6pt;
            color: #333;
            word-break: break-all;
            margin-bottom: 2mm;
          }
          .label-meta {
            font-size: 7pt;
            color: #666;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="grid">${labelsHtml}</div>
        <script>
          window.onload = function() {
            // Wait for barcode images to load before printing
            var imgs = document.getElementsByTagName('img');
            var loaded = 0;
            var total = imgs.length;
            if (total === 0) { window.print(); return; }
            for (var i = 0; i < total; i++) {
              imgs[i].onload = function() {
                loaded++;
                if (loaded === total) window.print();
              };
              imgs[i].onerror = function() {
                loaded++;
                if (loaded === total) window.print();
              };
            }
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Print Barcode Labels</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--color-text-sec)', marginBottom: 20 }}>
            {copies.length} label(s) will be printed for <strong>{bookTitle}</strong>.
            Labels are sized for a 3-per-row A4 sheet.
          </p>

          {/* Label Preview Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {copies.map(copy => (
              <div key={copy.id} style={{
                border: '1px solid var(--color-border)',
                padding: '12px 10px',
                textAlign: 'center',
                background: '#fff',
                borderRadius: 'var(--radius)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {bookTitle.slice(0, 28)}{bookTitle.length > 28 ? '…' : ''}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-ter)', marginBottom: 8 }}>
                  ISBN: {isbn}
                </div>
                <BarcodeImage barcode={copy.barcode} width={160} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-sec)', marginTop: 6, wordBreak: 'break-all' }}>
                  {copy.barcode.slice(0, 24)}…
                </div>
                {copy.location && (
                  <div style={{ fontSize: 10, color: 'var(--color-text-ter)', marginTop: 4 }}>
                    Shelf: {copy.location}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="notice notice-info">
            Labels open in a new window and print automatically when barcode images finish loading.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button id="print-labels-btn" className="btn btn-primary" onClick={handlePrint}>
            Open Print Window
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Update Copy Modal ────────────────────────────────────────────────────────
function UpdateCopyModal({ copy, onClose, onSaved }: { copy: Copy; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ condition: copy.condition, location: copy.location ?? '', status: copy.status, notes: copy.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await api.patch(`/catalog/copies/${copy.id}`, form);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Failed to update copy.');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Update Copy</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            {err && <div className="notice notice-error" style={{ marginBottom: 14 }}>{err}</div>}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-ter)', marginBottom: 16, wordBreak: 'break-all' }}>
              {copy.barcode}
            </div>
            <div className="form-grid">
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">Condition</label>
                  <select className="form-select" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                    <option value="NEW">New</option>
                    <option value="GOOD">Good</option>
                    <option value="WORN">Worn</option>
                    <option value="DAMAGED">Damaged</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="AVAILABLE">Available</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="RETIRED">Retired</option>
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Shelf Location</label>
                <input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. B-04-2" />
              </div>
              <div className="form-field">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCopies, setSelectedCopies] = useState<Set<string>>(new Set());
  const [printModal, setPrintModal] = useState(false);
  const [editCopy, setEditCopy] = useState<Copy | null>(null);
  const [addingCopies, setAddingCopies] = useState(false);
  const [newCopyCount, setNewCopyCount] = useState(1);
  const [newCopyLocation, setNewCopyLocation] = useState('');
  const [addErr, setAddErr] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/catalog/books/${id}`);
      setBook(data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load book.');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  function toggleCopy(copyId: string) {
    setSelectedCopies(prev => {
      const next = new Set(prev);
      next.has(copyId) ? next.delete(copyId) : next.add(copyId);
      return next;
    });
  }

  function selectAll() {
    if (book) setSelectedCopies(new Set(book.copies.map(c => c.id)));
  }

  function clearSelection() { setSelectedCopies(new Set()); }

  async function handleAddCopies(e: React.FormEvent) {
    e.preventDefault();
    setAddErr('');
    try {
      await api.post(`/catalog/books/${id}/copies`, {
        condition: 'NEW',
        location: newCopyLocation || undefined,
        count: newCopyCount,
      });
      setAddingCopies(false);
      setNewCopyCount(1);
      setNewCopyLocation('');
      load();
    } catch (e: any) {
      setAddErr(e?.response?.data?.message ?? 'Failed to add copies.');
    }
  }

  if (loading) return <div className="page"><div className="empty-state"><p>Loading book details...</p></div></div>;
  if (error || !book) return <div className="page"><div className="notice notice-error">{error || 'Book not found.'}</div></div>;

  const selectedCopyObjects = book.copies.filter(c => selectedCopies.has(c.id));
  const availableCount = book.copies.filter(c => c.status === 'AVAILABLE').length;
  const issuedCount = book.copies.filter(c => c.status === 'ISSUED').length;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-breadcrumb" style={{ marginBottom: 4 }}>
            <span style={{ cursor: 'pointer', color: 'var(--color-accent)' }} onClick={() => navigate('/catalog')}>Catalog</span>
            {' / '}
            {book.category.name}
          </div>
          <div className="page-title">{book.title}</div>
          {book.subtitle && <div style={{ fontSize: 13, color: 'var(--color-text-sec)', marginTop: 2 }}>{book.subtitle}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {selectedCopies.size > 0 && (
            <button
              id="print-selected-btn"
              className="btn btn-secondary"
              onClick={() => setPrintModal(true)}
            >
              Print {selectedCopies.size} Label(s)
            </button>
          )}
          <button
            id="print-all-btn"
            className="btn btn-primary"
            onClick={() => { selectAll(); setPrintModal(true); }}
          >
            Print All Labels
          </button>
        </div>
      </div>

      {/* Book Metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
        <div className="table-wrapper">
          <table className="data-table">
            <tbody>
              <tr><td style={{ width: '38%', color: 'var(--color-text-sec)', fontWeight: 600, fontSize: 12 }}>ISBN</td>
                <td><span className="mono">{book.isbn}</span></td></tr>
              <tr><td style={{ color: 'var(--color-text-sec)', fontWeight: 600, fontSize: 12 }}>Author(s)</td>
                <td>{book.authors.join(', ')}</td></tr>
              <tr><td style={{ color: 'var(--color-text-sec)', fontWeight: 600, fontSize: 12 }}>Publisher</td>
                <td>{book.publisher}, {book.publishedYear}</td></tr>
              {book.edition && <tr><td style={{ color: 'var(--color-text-sec)', fontWeight: 600, fontSize: 12 }}>Edition</td>
                <td>{book.edition}</td></tr>}
              {book.pages && <tr><td style={{ color: 'var(--color-text-sec)', fontWeight: 600, fontSize: 12 }}>Pages</td>
                <td>{book.pages}</td></tr>}
              <tr><td style={{ color: 'var(--color-text-sec)', fontWeight: 600, fontSize: 12 }}>Category</td>
                <td><span className="tag">{book.category.name}</span></td></tr>
              <tr><td style={{ color: 'var(--color-text-sec)', fontWeight: 600, fontSize: 12 }}>Max Issue</td>
                <td>{book.category.maxIssueDays} days</td></tr>
              {book.category.finePolicy && (
                <tr><td style={{ color: 'var(--color-text-sec)', fontWeight: 600, fontSize: 12 }}>Fine Rate</td>
                  <td>&#x20B9;{Number(book.category.finePolicy.ratePerDay).toFixed(2)}/day
                    {book.category.finePolicy.gracePeriodDays > 0
                      ? ` (${book.category.finePolicy.gracePeriodDays}d grace)`
                      : ''}
                  </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Copy Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
            <div style={{ background: 'var(--color-surface)', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{book.copies.length}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-ter)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
            </div>
            <div style={{ background: 'var(--color-surface)', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-active)' }}>{availableCount}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-ter)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available</div>
            </div>
            <div style={{ background: 'var(--color-surface)', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: issuedCount > 0 ? 'var(--color-overdue)' : 'var(--color-text-ter)' }}>{issuedCount}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-ter)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Issued</div>
            </div>
          </div>

          {book.description && (
            <div style={{ border: '1px solid var(--color-border)', padding: '14px 16px', background: 'var(--color-surface)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-ter)', marginBottom: 8 }}>Description</div>
              <p style={{ fontSize: 13, color: 'var(--color-text-sec)', lineHeight: 1.6 }}>{book.description}</p>
            </div>
          )}

          {book.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {book.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* Copies Table */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">Physical Copies ({book.copies.length})</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selectedCopies.size > 0 ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--color-text-sec)' }}>{selectedCopies.size} selected</span>
                <button className="btn btn-ghost btn-sm" onClick={clearSelection}>Clear</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setPrintModal(true)}>
                  Print Selected
                </button>
              </>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={selectAll}>Select All</button>
            )}
            <button
              id="add-copies-btn"
              className="btn btn-primary btn-sm"
              onClick={() => setAddingCopies(true)}
            >
              + Add Copies
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selectedCopies.size === book.copies.length && book.copies.length > 0}
                    onChange={e => e.target.checked ? selectAll() : clearSelection()}
                  />
                </th>
                <th>Barcode</th>
                <th>Barcode Preview</th>
                <th>Location</th>
                <th>Condition</th>
                <th>Status</th>
                <th>Acquired</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {book.copies.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-ter)' }}>
                  No copies in inventory. Add copies using the button above.
                </td></tr>
              ) : book.copies.map(copy => (
                <tr key={copy.id} style={{ background: selectedCopies.has(copy.id) ? 'var(--color-accent-light)' : undefined }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedCopies.has(copy.id)}
                      onChange={() => toggleCopy(copy.id)}
                    />
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 11 }}>
                      {copy.barcode}
                    </span>
                  </td>
                  <td style={{ padding: '6px 14px' }}>
                    <BarcodeImage barcode={copy.barcode} width={140} />
                  </td>
                  <td className="dim">{copy.location ?? '—'}</td>
                  <td>
                    <span className={`status ${COND_CLASS[copy.condition] ?? ''}`}>
                      {copy.condition}
                    </span>
                  </td>
                  <td>
                    <span className={`status ${STATUS_CLASS[copy.status] ?? ''}`}>
                      {copy.status}
                    </span>
                  </td>
                  <td className="dim">{fmtDate(copy.acquiredAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setSelectedCopies(new Set([copy.id])); setPrintModal(true); }}
                      >
                        Print
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditCopy(copy)}
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Copies Modal */}
      {addingCopies && (
        <div className="modal-overlay" onClick={() => setAddingCopies(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Copies</div>
              <button className="modal-close" onClick={() => setAddingCopies(false)}>×</button>
            </div>
            <form onSubmit={handleAddCopies}>
              <div className="modal-body">
                {addErr && <div className="notice notice-error" style={{ marginBottom: 14 }}>{addErr}</div>}
                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label">Number of Copies *</label>
                    <input
                      className="form-input"
                      type="number" min={1} max={50} required
                      value={newCopyCount}
                      onChange={e => setNewCopyCount(parseInt(e.target.value, 10))}
                    />
                    <div className="form-hint">UUIDv7 barcodes are auto-generated for each copy.</div>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Shelf Location</label>
                    <input
                      className="form-input"
                      value={newCopyLocation}
                      onChange={e => setNewCopyLocation(e.target.value)}
                      placeholder="e.g. A-04-2 (optional)"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAddingCopies(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add {newCopyCount} Copy/Copies</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {printModal && selectedCopyObjects.length > 0 && (
        <PrintLabelModal
          copies={selectedCopyObjects}
          bookTitle={book.title}
          isbn={book.isbn}
          onClose={() => setPrintModal(false)}
        />
      )}

      {/* Edit Copy Modal */}
      {editCopy && (
        <UpdateCopyModal
          copy={editCopy}
          onClose={() => setEditCopy(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
