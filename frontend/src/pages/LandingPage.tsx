interface LandingPageProps {
  onGoToLogin: () => void;
}

const HOW_IT_WORKS = [
  { step: '1', title: 'Describe the incident', detail: 'Type what happened in plain language. AI extracts structured fields in seconds.' },
  { step: '2', title: 'Upload evidence & answer questions', detail: 'Add photos with AI damage analysis and complete a personalized interview.' },
  { step: '3', title: 'Export your packet', detail: 'Generate an insurance-ready narrative and export a print-ready PDF.' },
];

export default function LandingPage({ onGoToLogin }: LandingPageProps) {
  return (
    <div style={{
      position: 'relative',
      height: 'calc(100vh - 56px)',
      overflow: 'hidden',
      backgroundImage: 'url(/hero-bg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* dark overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(7, 20, 40, 0.62)' }} />

      {/* ── Hero row ── */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '2fr 3fr',
        gap: '32px',
        alignItems: 'center',
        padding: '28px 32px 16px',
      }}>
        {/* Left: text */}
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(37,99,235,0.18)',
            border: '1px solid rgba(37,99,235,0.35)',
            borderRadius: 9999,
            padding: '5px 14px',
            marginBottom: 16,
          }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, background: '#2563eb', display: 'grid', placeItems: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#fff' }}>C</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#93c5fd', letterSpacing: '0.02em' }}>ClaimPilot — Claims Intelligence</span>
          </div>

          <h1 style={{ margin: '0 0 14px', fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.1, color: '#f8fafc' }}>
            Smarter claims,<br />faster recovery.
            <br />
            <span style={{
              background: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Built for rideshare drivers.
            </span>
          </h1>

          <p style={{ margin: '0 0 22px', color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.65 }}>
            ClaimPilot guides you through every step of documenting a vehicle incident —
            from first description to final PDF — using AI to fill in the blanks and flag what's missing.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <button
              type="button"
              onClick={onGoToLogin}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 26px',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(37,99,235,0.4)',
              }}
            >
              Get started →
            </button>
            <button
              type="button"
              onClick={onGoToLogin}
              style={{
                background: 'transparent',
                color: '#cbd5e1',
                border: '1.5px solid rgba(255,255,255,0.2)',
                borderRadius: 12,
                padding: '12px 22px',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              View demo
            </button>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {['Powered by AI', 'Secure cloud storage', 'PDF export ready'].map((t) => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.73rem', color: '#64748b' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right: dashboard screenshot */}
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src="/dashboard-screenshot.png"
            alt="ClaimPilot dashboard"
            style={{
              width: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 12,
              boxShadow: '0 20px 60px rgba(7,27,46,0.65)',
              display: 'block',
            }}
          />
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 32px 16px',
      }}>
        <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#93c5fd' }}>How it works</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>{s.step}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f1f5f9', marginBottom: 2 }}>{s.title}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.74rem', lineHeight: 1.5 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
