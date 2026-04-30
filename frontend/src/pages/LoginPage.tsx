import { useState } from 'react';
import { login } from '../utils/auth';
import type { AuthSession } from '../utils/auth';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

interface LoginPageProps {
  onLoginSuccess: (session: AuthSession) => void;
}

function SignupModal({ onClose }: { onClose: () => void }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userId.trim(), password, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit request.');
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #d1d5db', borderRadius: 10,
    padding: '9px 12px', fontSize: '0.88rem',
    outline: 'none', color: '#0f172a',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', fontWeight: 600,
    color: '#374151', marginBottom: 5,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, padding: '32px',
          width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: '#dcfce7',
              display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: '1.5rem',
            }}>
              ✓
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              Request submitted!
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>
              Your access request has been sent. You'll be contacted at the username you provided once it's reviewed.
            </p>
            <button
              onClick={onClose}
              style={{
                background: '#2563eb', color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px 28px', fontWeight: 700,
                fontSize: '0.9rem', cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                Request access
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                Fill in the details below — the admin will review your request.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>User ID</label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Choose a username"
                  autoComplete="username"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Why do you need access?</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Briefly describe why you need access to ClaimPilot…"
                  required
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
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

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1, background: '#fff', color: '#374151',
                    border: '1px solid #d1d5db', borderRadius: 10,
                    padding: '10px', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 2, background: loading ? '#93c5fd' : '#2563eb',
                    color: '#fff', border: 'none', borderRadius: 10,
                    padding: '10px', fontWeight: 700, fontSize: '0.88rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Submitting…' : 'Request Access →'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

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
    <>
      {showSignup && <SignupModal onClose={() => setShowSignup(false)} />}

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
            href="mailto:manasa.somisetty12@gmail.com"
            style={{ color: '#b45309', fontWeight: 600 }}
          >
            manasa.somisetty12@gmail.com
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

          <div style={{ marginTop: 20, textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Don't have an account?{' '}</span>
            <button
              type="button"
              onClick={() => setShowSignup(true)}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: '#2563eb', fontWeight: 700, fontSize: '0.82rem',
                cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Request access
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
