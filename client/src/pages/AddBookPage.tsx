import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';

interface Category { id: string; name: string; maxIssueDays: number; }

// ─── CSV Template ─────────────────────────────────────────────────────────────
const CSV_HEADERS = 'isbn,title,subtitle,authors,publisher,publishedYear,edition,language,pages,categoryName,description,tags,copies,location';
const CSV_EXAMPLE = `978-0-13-468599-1,Operating System Concepts,,"Abraham Silberschatz; Peter Galvin; Greg Gagne",Wiley,2018,10th Edition,en,944,Computer Science,Classic OS textbook,os;systems;kernels,2,A-01-1
978-0-07-352333-7,Database System Concepts,,"Abraham Silberschatz; Henry Korth",McGraw-Hill,2019,7th Edition,en,1376,Computer Science,Comprehensive DB text,database;sql,1,A-02-3`;

function downloadTemplate() {
  const blob = new Blob([CSV_HEADERS + '\n' + CSV_EXAMPLE], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'libracms_book_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

interface ParsedRow {
  isbn: string; title: string; subtitle?: string; authors: string[];
  publisher: string; publishedYear: number; edition?: string; language: string;
  pages?: number; categoryName: string; categoryId?: string;
  description?: string; tags: string[]; copies: number; location?: string;
  _error?: string;
}

function parseCSV(text: string, categories: Category[]): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const catMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) { // skip header
    const cols = parseCSVLine(lines[i]);
    const [isbn, title, subtitle, authorsRaw, publisher, yearRaw, edition,
           language, pagesRaw, categoryName, description, tagsRaw, copiesRaw, location] = cols;

    const row: ParsedRow = {
      isbn: isbn ?? '',
      title: title ?? '',
      subtitle: subtitle || undefined,
      authors: (authorsRaw ?? '').split(';').map(a => a.trim()).filter(Boolean),
      publisher: publisher ?? '',
      publishedYear: parseInt(yearRaw, 10),
      edition: edition || undefined,
      language: language || 'en',
      pages: pagesRaw ? parseInt(pagesRaw, 10) : undefined,
      categoryName: categoryName ?? '',
      categoryId: catMap.get((categoryName ?? '').toLowerCase()),
      description: description || undefined,
      tags: (tagsRaw ?? '').split(';').map(t => t.trim()).filter(Boolean),
      copies: Math.max(1, parseInt(copiesRaw, 10) || 1),
      location: location || undefined,
    };

    // Validate required fields
    const errs: string[] = [];
    if (!row.isbn) errs.push('ISBN missing');
    if (!row.title) errs.push('Title missing');
    if (!row.authors.length) errs.push('Authors missing');
    if (!row.publisher) errs.push('Publisher missing');
    if (isNaN(row.publishedYear)) errs.push('Invalid year');
    if (!row.categoryId) errs.push(`Category "${row.categoryName}" not found`);

    if (errs.length) row._error = errs.join(', ');
    rows.push(row);
  }
  return rows;
}

interface ImportResult {
  index: number; isbn: string; title: string; success: boolean; error?: string;
}

// ─── Single Book Form (unchanged logic) ──────────────────────────────────────
function SingleBookForm({ categories }: { categories: Category[] }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    isbn: '', title: '', subtitle: '', authors: '', publisher: '',
    publishedYear: new Date().getFullYear(), edition: '', language: 'en',
    pages: '', categoryId: '', description: '', tags: '',
  });
  const [copyCount, setCopyCount] = useState(1);
  const [copyLocation, setCopyLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        isbn: form.isbn.trim(), title: form.title.trim(),
        authors: form.authors.split(',').map(a => a.trim()).filter(Boolean),
        publisher: form.publisher.trim(),
        publishedYear: parseInt(String(form.publishedYear), 10),
        language: form.language, categoryId: form.categoryId,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      if (form.subtitle.trim()) payload.subtitle = form.subtitle.trim();
      if (form.edition.trim()) payload.edition = form.edition.trim();
      if (form.pages) payload.pages = parseInt(form.pages, 10);
      if (form.description.trim()) payload.description = form.description.trim();

      const { data: book } = await api.post('/catalog/books', payload);
      if (copyCount > 0) {
        await api.post(`/catalog/books/${book.id}/copies`, {
          condition: 'NEW', location: copyLocation.trim() || undefined, count: copyCount,
        });
      }
      setResult(book);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to add book. Check all fields and try again.');
    } finally { setSaving(false); }
  }

  if (result) {
    return (
      <div style={{ maxWidth: 520 }}>
        <div className="notice notice-success" style={{ marginBottom: 20 }}>
          <strong>"{result.title}"</strong> added to catalog with {copyCount} cop{copyCount === 1 ? 'y' : 'ies'}.
        </div>
        <div className="table-wrapper" style={{ marginBottom: 20 }}>
          <table className="data-table">
            <tbody>
              <tr><td style={{ width: '35%', color: 'var(--color-text-sec)' }}>ISBN</td><td className="mono">{result.isbn}</td></tr>
              <tr><td style={{ color: 'var(--color-text-sec)' }}>Title</td><td style={{ fontWeight: 600 }}>{result.title}</td></tr>
              <tr><td style={{ color: 'var(--color-text-sec)' }}>Book ID</td><td className="mono" style={{ fontSize: 11 }}>{result.id}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setResult(null)}>Add Another Book</button>
          <button className="btn btn-secondary" onClick={() => navigate('/catalog')}>Go to Catalog</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {error && <div className="notice notice-error" style={{ marginBottom: 16 }}>{error}</div>}
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="section">
          <div className="section-title" style={{ marginBottom: 14 }}>Identification</div>
          <div className="form-grid">
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">ISBN *</label>
                <input id="book-isbn" className="form-input" required value={form.isbn} onChange={field('isbn')} placeholder="978-..." />
              </div>
              <div className="form-field">
                <label className="form-label">Category *</label>
                <select id="book-category" className="form-select" required value={form.categoryId} onChange={field('categoryId')}>
                  <option value="">Select category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Title *</label>
              <input id="book-title" className="form-input" required value={form.title} onChange={field('title')} placeholder="Full title" />
            </div>
            <div className="form-field">
              <label className="form-label">Subtitle</label>
              <input className="form-input" value={form.subtitle} onChange={field('subtitle')} placeholder="Optional subtitle" />
            </div>
            <div className="form-field">
              <label className="form-label">Author(s) * <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(comma separated)</span></label>
              <input id="book-authors" className="form-input" required value={form.authors} onChange={field('authors')} placeholder="e.g. Abraham Silberschatz, Henry Korth" />
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title" style={{ marginBottom: 14 }}>Publication</div>
          <div className="form-grid">
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Publisher *</label>
                <input id="book-publisher" className="form-input" required value={form.publisher} onChange={field('publisher')} placeholder="Publisher name" />
              </div>
              <div className="form-field">
                <label className="form-label">Year *</label>
                <input className="form-input" type="number" required value={form.publishedYear} onChange={field('publishedYear')} min={1800} max={2100} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Edition</label>
                <input className="form-input" value={form.edition} onChange={field('edition')} placeholder="e.g. 7th Edition" />
              </div>
              <div className="form-field">
                <label className="form-label">Language</label>
                <select className="form-select" value={form.language} onChange={field('language')}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="kn">Kannada</option>
                  <option value="mr">Marathi</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Pages</label>
                <input className="form-input" type="number" value={form.pages} onChange={field('pages')} placeholder="Optional" min={1} />
              </div>
              <div className="form-field">
                <label className="form-label">Tags <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(comma separated)</span></label>
                <input className="form-input" value={form.tags} onChange={field('tags')} placeholder="database, sql, algorithms" />
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={field('description')} rows={3} placeholder="Brief description of the book..." />
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title" style={{ marginBottom: 14 }}>Initial Physical Copies</div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Number of Copies</label>
              <input id="book-copy-count" className="form-input" type="number" min={0} max={50}
                value={copyCount} onChange={e => setCopyCount(parseInt(e.target.value, 10))} />
              <div className="form-hint">Barcodes will be auto-generated for each copy.</div>
            </div>
            <div className="form-field">
              <label className="form-label">Shelf Location</label>
              <input className="form-input" value={copyLocation} onChange={e => setCopyLocation(e.target.value)} placeholder="e.g. A-12-3" />
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
          <Link to="/catalog" className="btn btn-secondary">Cancel</Link>
          <button id="book-submit" className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Adding Book...' : 'Add Book to Catalog'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Bulk Import Form ─────────────────────────────────────────────────────────
function BulkImportForm({ categories }: { categories: Category[] }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [importSummary, setImportSummary] = useState<{ imported: number; failed: number } | null>(null);
  const [parseError, setParseError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file.');
      return;
    }
    setParseError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text, categories);
      if (!parsed.length) {
        setParseError('No rows found. Make sure the CSV has a header row and at least one data row.');
        return;
      }
      setRows(parsed);
      setImportResults(null);
      setImportSummary(null);
    };
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  async function handleImport() {
    const validRows = rows.filter(r => !r._error);
    if (!validRows.length) return;
    setImporting(true);
    try {
      const payload = validRows.map(r => ({
        isbn: r.isbn, title: r.title, subtitle: r.subtitle,
        authors: r.authors, publisher: r.publisher,
        publishedYear: r.publishedYear, edition: r.edition,
        language: r.language, pages: r.pages,
        categoryId: r.categoryId!, description: r.description,
        tags: r.tags, copies: r.copies, location: r.location,
      }));
      const { data } = await api.post('/catalog/books/bulk-import', { rows: payload });
      setImportResults(data.results);
      setImportSummary({ imported: data.imported, failed: data.failed });
    } catch (err: any) {
      setParseError(err?.response?.data?.message ?? 'Import failed. Please try again.');
    } finally { setImporting(false); }
  }

  const validCount = rows.filter(r => !r._error).length;
  const errorCount = rows.filter(r => r._error).length;

  if (importSummary && importResults) {
    return (
      <div style={{ maxWidth: 780 }}>
        {/* Summary banner */}
        <div style={{
          display: 'flex', gap: 16, marginBottom: 24, padding: '16px 20px',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 8,
        }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-success, #1a5c2e)' }}>{importSummary.imported}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-sec)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Imported</div>
          </div>
          <div style={{ width: 1, background: 'var(--color-border)' }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: importSummary.failed > 0 ? 'var(--color-overdue, #8b1a1a)' : 'var(--color-text-ter)' }}>{importSummary.failed}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-sec)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Failed</div>
          </div>
        </div>

        <div className="table-wrapper" style={{ marginBottom: 20 }}>
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>ISBN</th><th>Title</th><th>Result</th></tr>
            </thead>
            <tbody>
              {importResults.map((r, i) => (
                <tr key={i}>
                  <td className="mono" style={{ color: 'var(--color-text-ter)', width: 40 }}>{r.index + 1}</td>
                  <td className="mono">{r.isbn}</td>
                  <td style={{ fontWeight: 500 }}>{r.title}</td>
                  <td>
                    {r.success
                      ? <span className="status status-active">✓ Imported</span>
                      : <span title={r.error} style={{ color: 'var(--color-overdue, #8b1a1a)', fontSize: 12 }}>✕ {r.error}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => { setRows([]); setImportResults(null); setImportSummary(null); setFileName(''); }}>
            Import Another File
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/catalog')}>Go to Catalog</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 780 }}>
      {/* Instructions */}
      <div className="section" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 10 }}>CSV Format</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-sec)', lineHeight: 1.6 }}>
          Upload a CSV with these columns (first row must be headers):
        </div>
        <div style={{
          marginTop: 8, padding: '10px 14px', background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 6,
          fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-sec)',
          overflowX: 'auto', whiteSpace: 'nowrap',
        }}>
          {CSV_HEADERS}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-ter)' }}>
          • <code>authors</code> and <code>tags</code>: use <strong>semicolons</strong> to separate multiple values<br />
          • <code>categoryName</code>: must exactly match an existing category name (case-insensitive)<br />
          • <code>copies</code>: number of physical copies to add (defaults to 1)
        </div>
        <button className="btn btn-secondary" style={{ marginTop: 10, fontSize: 12 }} onClick={downloadTemplate}>
          ⬇ Download Template CSV
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 10,
          padding: '40px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'var(--color-surface)' : 'transparent',
          transition: 'all 0.2s',
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-pri)' }}>
          {fileName ? `📄 ${fileName}` : 'Drag & drop your CSV here, or click to browse'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-ter)', marginTop: 4 }}>
          Supports .csv files up to 200 rows
        </div>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileChange} />
      </div>

      {parseError && <div className="notice notice-error" style={{ marginBottom: 16 }}>{parseError}</div>}

      {/* Preview table */}
      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-sec)' }}>
              <strong style={{ color: 'var(--color-text-pri)' }}>{rows.length}</strong> rows detected —{' '}
              <span style={{ color: 'var(--color-success, #1a5c2e)', fontWeight: 600 }}>{validCount} valid</span>
              {errorCount > 0 && <>, <span style={{ color: 'var(--color-overdue, #8b1a1a)', fontWeight: 600 }}>{errorCount} with errors</span></>}
            </div>
          </div>

          <div className="table-wrapper" style={{ marginBottom: 20, maxHeight: 360, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>ISBN</th><th>Title</th><th>Authors</th>
                  <th>Category</th><th>Year</th><th>Copies</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={row._error ? { background: 'rgba(139,26,26,0.05)' } : {}}>
                    <td className="mono" style={{ color: 'var(--color-text-ter)', width: 36 }}>{i + 1}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{row.isbn}</td>
                    <td style={{ fontWeight: 500, maxWidth: 200 }}>{row.title}</td>
                    <td className="dim" style={{ maxWidth: 140 }}>{row.authors.join(', ')}</td>
                    <td>
                      {row.categoryId
                        ? <span className="tag">{row.categoryName}</span>
                        : <span style={{ color: 'var(--color-overdue, #8b1a1a)', fontSize: 12 }}>{row.categoryName || '—'}</span>
                      }
                    </td>
                    <td className="mono">{row.publishedYear || '—'}</td>
                    <td className="mono">{row.copies}</td>
                    <td>
                      {row._error
                        ? <span title={row._error} style={{ color: 'var(--color-overdue, #8b1a1a)', fontSize: 11 }}>✕ {row._error}</span>
                        : <span className="status status-active">✓ Ready</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-actions" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => { setRows([]); setFileName(''); }}>
              Clear
            </button>
            <button
              id="bulk-import-submit"
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing || validCount === 0}
            >
              {importing ? `Importing ${validCount} books…` : `Import ${validCount} Book${validCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AddBookPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  useEffect(() => {
    api.get('/catalog/categories').then(({ data }) => setCategories(data));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Add Book</div>
          <div className="page-breadcrumb">
            Catalog — {activeTab === 'single' ? 'Add New Book' : 'Bulk CSV Import'}
          </div>
        </div>
      </div>

      {/* Mode tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--color-border)' }}>
        {(['single', 'bulk'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '8px 22px',
              fontSize: 13,
              fontWeight: 600,
              borderBottom: activeTab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: activeTab === t ? 'var(--color-accent)' : 'var(--color-text-sec)',
              background: 'none',
              border: 'none',
              borderBottomWidth: 2,
              borderBottomStyle: 'solid',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t === 'single' ? '📖 Single Book' : '📦 Bulk Import (CSV)'}
          </button>
        ))}
      </div>

      {activeTab === 'single'
        ? <SingleBookForm categories={categories} />
        : <BulkImportForm categories={categories} />
      }
    </div>
  );
}
