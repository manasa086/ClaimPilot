import React from 'react';
import type { AuthSession } from '../utils/auth';

const AI_PROVIDER = (import.meta.env.VITE_AI_PROVIDER ?? 'openai').toLowerCase();

function AiProviderBadge() {
  const isClaude = AI_PROVIDER === 'claude';
  return (
    <span style={{
      fontSize: '0.72rem',
      fontWeight: 700,
      padding: '3px 9px',
      borderRadius: 9999,
      background: isClaude ? '#f5f0ff' : '#e8f4ff',
      color: isClaude ? '#7c3aed' : '#2563eb',
      border: `1px solid ${isClaude ? '#ddd6fe' : '#bfdbfe'}`,
      letterSpacing: '0.03em',
    }}>
      {isClaude ? 'Claude' : 'GPT-4o'}
    </span>
  );
}

export type AppTab = 'landing' | 'login' | 'claims';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  authSession: AuthSession | null;
  onLogout: () => void;
  onNewClaim?: () => void;
}

export default function AppShell({ children, activeTab, onTabChange, authSession, onLogout, onNewClaim }: AppShellProps) {
  const tabStyle = (tab: AppTab): React.CSSProperties => ({
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 600,
    padding: '6px 14px',
    borderRadius: 8,
    color: activeTab === tab ? '#fff' : '#94a3b8',
    background: activeTab === tab ? 'rgba(255,255,255,0.12)' : 'transparent',
    transition: 'background 0.15s',
  });

  const initials = authSession
    ? authSession.userName.slice(0, 2).toUpperCase()
    : '';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fbff', color: '#0f172a' }}>
      <header style={{ background: '#071b2e', padding: '12px 0', color: '#fff' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          {/* Logo + nav tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: '#2563eb', display: 'grid', placeItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>C</span>
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                  ClaimPilot
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Claims intelligence for accident recovery</div>
              </div>
            </div>

            {/* Tabs */}
            <nav style={{ display: 'flex', gap: 2 }}>
              <button style={tabStyle('landing')} onClick={() => onTabChange('landing')}>Home</button>
              {!authSession && (
                <button style={tabStyle('login')} onClick={() => onTabChange('login')}>Login</button>
              )}
              <button style={tabStyle('claims')} onClick={() => onTabChange('claims')}>{authSession ? 'Dashboard' : 'Demo'}</button>
            </nav>
          </div>

          {/* Right side actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {authSession && activeTab === 'claims' && onNewClaim && (
              <button
                onClick={onNewClaim}
                style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: 9999, padding: '7px 12px', color: '#fff', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                New claim
              </button>
            )}
            {authSession ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0f172a', borderRadius: 9999, padding: '6px 12px' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#eef2ff', color: '#0f172a', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                  {initials}
                </span>
                <div>
                  <div style={{ fontSize: '0.82rem' }}>{authSession.userName}</div>
                  <button
                    onClick={onLogout}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.7rem', color: '#64748b', cursor: 'pointer' }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onTabChange('login')}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 9999, padding: '7px 16px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="container" style={{ padding: '20px 0 32px' }}>{children}</main>
    </div>
  );
}
