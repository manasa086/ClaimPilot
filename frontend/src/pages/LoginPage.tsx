import { useState } from 'react';
import { login } from '../utils/auth';
import type { AuthSession } from '../utils/auth';

interface LoginPageProps {
  onLoginSuccess: (session: AuthSession) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { session, error: err } = await login(username.trim(), password);
    setLoading(false);
    if (session) {
      onLoginSuccess(session);
    } else {
      setError(err ?? 'Login failed.');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '48px auto', padding: '0 16px' }}>
      {/* Restricted access notice */}
      <div style={{
        background: '#fff7ed',
        border: '1px solid #fed7aa',
        borderRadius: 12,
        padding: '14px 18px',
        marginBottom: 28,
        fontSize: '0.83rem',
        color: '#92400e',
        lineHeight: 1.6,
      }}>
        <strong>Restricted access.</strong> This application is private. If you need access, please email{' '}
        <a
          href="mailto:manasa.somisetty06@gmail.com"
          style={{ color: '#b45309', fontWeight: 600 }}
        >
          manasa.somisetty06@gmail.com
        </a>
        .
      </div>

      {/* Login card */}
      <div className="card" style={{ padding: '32px 32px 28px', borderRadius: 20 }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: '#2563eb',
            display: 'grid', placeItems: 'center', margin: '0 auto 12px',
          }}>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>C</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Sign in to ClaimPilot</h2>
          <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#64748b' }}>Enter your credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1px solid #d1d5db', borderRadius: 10,
                padding: '9px 12px', fontSize: '0.88rem',
                outline: 'none', color: '#0f172a',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1px solid #d1d5db', borderRadius: 10,
                padding: '9px 12px', fontSize: '0.88rem',
                outline: 'none', color: '#0f172a',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '9px 12px', marginBottom: 16, fontSize: '0.82rem', color: '#991b1b',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', background: loading ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '11px', fontWeight: 700, fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>
      </div>
    </div>
  );
}
