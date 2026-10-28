import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">Library Management System</div>
          <div className="login-title">Sign in</div>
        </div>
        <div className="login-body">
          <form className="form-grid" onSubmit={handleSubmit}>
            {error && (
              <div className="notice notice-error">
                <span>{error}</span>
              </div>
            )}
            <div className="form-field">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                id="email"
                className="form-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="user@college.edu"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="form-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              id="login-submit"
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <div className="login-footer">
          <p>Access is restricted to authorised college personnel and students.</p>
        </div>
      </div>
    </div>
  );
}
