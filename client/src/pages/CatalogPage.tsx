import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Book {
  id: string;
  isbn: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher: string;
  publishedYear: number;
  language: string;
  category: { id: string; name: string; maxIssueDays: number };
  totalCopies: number;
  availableCopies: number;
  coverUrl?: string;
  tags: string[];
}

interface Category { id: string; name: string; }

export default function CatalogPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [available, setAvailable] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  useEffect(() => {
    api.get('/catalog/categories').then(({ data }) => setCategories(data));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set('q', q);
      if (categoryId) params.set('categoryId', categoryId);
      if (available) params.set('available', available);
      const { data } = await api.get(`/catalog/books?${params}`);
      setBooks(data.data);
      setTotal(data.meta.total);
    } finally {
      setLoading(false);
    }
  }, [q, categoryId, available, page]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Catalog</div>
          <div className="page-breadcrumb">Digital Catalog — {total} books</div>
        </div>
        {user?.role !== 'STUDENT' && (
          <Link to="/catalog/new" className="btn btn-primary">+ Add Book</Link>
        )}
      </div>

      <div className="filters-bar">
        <input
          id="catalog-search"
          className="filter-input"
          style={{ minWidth: 300 }}
          placeholder="Search by title, author, ISBN, tag..."
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
        />
        <select
          id="catalog-category"
          className="filter-select"
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          id="catalog-availability"
          className="filter-select"
          value={available}
          onChange={e => { setAvailable(e.target.value); setPage(1); }}
        >
          <option value="">All Availability</option>
          <option value="true">Available Only</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ISBN</th>
              <th>Title / Author</th>
              <th>Category</th>
              <th>Publisher</th>
              <th>Year</th>
              <th>Copies</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="loading-row"><td colSpan={7}>Loading catalog...</td></tr>
            ) : books.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-ter)' }}>No books found</td></tr>
            ) : books.map(book => (
              <tr key={book.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/catalog/${book.id}`)}>
                <td><span className="mono">{book.isbn}</span></td>
                <td>
                  <div style={{ fontWeight: 500 }}>{book.title}</div>
                  <div className="dim">{book.authors.join(', ')}</div>
                </td>
                <td><span className="tag">{book.category.name}</span></td>
                <td className="dim">{book.publisher}</td>
                <td className="dim">{book.publishedYear}</td>
                <td style={{ textAlign: 'center' }}>{book.totalCopies}</td>
                <td>
                  <span className={`status ${book.availableCopies > 0 ? 'status-available' : 'status-issued'}`}>
                    {book.availableCopies > 0 ? book.availableCopies : 'None'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="pagination-info">{total} books in catalog</span>
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span style={{ fontSize: 12, color: 'var(--color-text-sec)' }}>{page} / {totalPages || 1}</span>
        <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
}
