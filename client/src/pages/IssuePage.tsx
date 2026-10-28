import React, { useState } from 'react';
import api from '../lib/api';

interface IssueResult {
  issueId: string;
  title: string;
  barcode: string;
  dueAt: string;
  studentName: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'long' });
}

export default function IssuePage() {
  const [barcode, setBarcode] = useState('');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [studentErr, setStudentErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [error, setError] = useState('');

  async function lookupStudent() {
    if (!enrollmentId.trim()) return;
    setStudentErr('');
    setStudent(null);
    try {
      const { data } = await api.get(`/users?q=${encodeURIComponent(enrollmentId)}&role=STUDENT&limit=1`);
      if (data.data.length === 0) {
        setStudentErr('No student found with this Enrollment ID.');
      } else {
        setStudent(data.data[0]);
      }
    } catch {
      setStudentErr('Failed to look up student.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!student || !barcode.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/issues', { barcode: barcode.trim(), userId: student.id });
      setResult(data);
      setBarcode('');
      setEnrollmentId('');
      setStudent(null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Issue failed. Please check the details and retry.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() { setResult(null); setError(''); }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Issue Book</div>
          <div className="page-breadcrumb">Circulation — Issue Book to Student</div>
        </div>
      </div>

      {result ? (
        <div style={{ maxWidth: 520 }}>
          <div className="notice notice-success" style={{ marginBottom: 20 }}>
            Book issued successfully.
          </div>
          <div className="table-wrapper" style={{ marginBottom: 20 }}>
            <table className="data-table">
              <tbody>
                <tr><td className="form-label" style={{ width: '40%' }}>Student</td><td>{result.studentName}</td></tr>
                <tr><td className="form-label">Title</td><td style={{ fontWeight: 600 }}>{result.title}</td></tr>
                <tr><td className="form-label">Barcode</td><td><span className="mono">{result.barcode}</span></td></tr>
                <tr><td className="form-label">Issue ID</td><td><span className="mono" style={{ fontSize: 11 }}>{result.issueId}</span></td></tr>
                <tr><td className="form-label">Due Date</td><td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{fmtDate(result.dueAt)}</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button id="issue-another" className="btn btn-primary" onClick={reset}>Issue Another Book</button>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 520 }}>
          {error && <div className="notice notice-error" style={{ marginBottom: 16 }}>{error}</div>}

          <form className="form-grid" onSubmit={handleSubmit}>
            {/* Step 1: Student Lookup */}
            <div className="section">
              <div className="section-title" style={{ marginBottom: 14 }}>1 — Identify Student</div>
              <div className="form-field">
                <label className="form-label" htmlFor="enrollment-id">Enrollment ID</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="enrollment-id"
                    className="form-input"
                    value={enrollmentId}
                    onChange={e => { setEnrollmentId(e.target.value); setStudent(null); }}
                    placeholder="e.g. CS22-042"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={lookupStudent}
                    disabled={!enrollmentId.trim()}
                  >
                    Lookup
                  </button>
                </div>
                {studentErr && <div className="form-error">{studentErr}</div>}
              </div>

              {student && (
                <div style={{
                  marginTop: 12, padding: '12px 14px',
                  background: 'var(--color-active-bg)',
                  border: '1px solid #b3d4bc',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                }}>
                  <strong>{student.name}</strong>
                  <span style={{ marginLeft: 12, color: 'var(--color-text-sec)' }}>
                    {student.department} &middot; {student.enrollmentId}
                  </span>
                </div>
              )}
            </div>

            {/* Step 2: Barcode */}
            <div className="section">
              <div className="section-title" style={{ marginBottom: 14 }}>2 — Scan Barcode</div>
              <div className="form-field">
                <label className="form-label" htmlFor="barcode-input">Book Barcode</label>
                <input
                  id="barcode-input"
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="Scan or type barcode — e.g. LIB-019..."
                  autoFocus={!!student}
                />
                <div className="form-hint">Scanner input is automatically submitted with Enter.</div>
              </div>
            </div>

            <div className="form-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
              <button
                id="issue-submit"
                className="btn btn-primary"
                type="submit"
                disabled={!student || !barcode.trim() || submitting}
              >
                {submitting ? 'Processing...' : 'Confirm Issue'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
