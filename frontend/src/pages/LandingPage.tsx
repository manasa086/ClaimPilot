interface LandingPageProps {
  onGoToLogin: () => void;
}

const features = [
  {
    icon: '🤖',
    title: 'AI-Powered Autofill',
    desc: 'Describe the incident in plain English and let AI extract the claim title, location, vehicle, and incident type automatically.',
  },
  {
    icon: '📸',
    title: 'Photo Evidence Storage',
    desc: 'Upload vehicle damage photos directly to secure cloud storage. AI analyzes each image and rates damage severity instantly.',
  },
  {
    icon: '📋',
    title: 'Guided Interview',
    desc: 'Answer a structured set of questions — including AI-generated follow-ups tailored to your specific incident — to build a complete record.',
  },
  {
    icon: '📊',
    title: 'Claim Readiness Score',
    desc: 'A live score tracks how complete your claim packet is, highlighting exactly what is still missing before submission.',
  },
  {
    icon: '📝',
    title: 'Professional Narrative',
    desc: 'Generate a polished, insurance-ready claim narrative written in neutral third-person language — ready to attach to any submission.',
  },
  {
    icon: '📤',
    title: 'One-Click PDF Export',
    desc: 'Export a clean, formatted claim packet with all details, photos, and interview notes embedded — print or share instantly.',
  },
];

export default function LandingPage({ onGoToLogin }: LandingPageProps) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 0 48px' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '48px 24px 40px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#eef2ff', borderRadius: 9999, padding: '6px 16px', marginBottom: 20 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: '#2563eb', display: 'grid', placeItems: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>C</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2563eb' }}>ClaimPilot — Claims Intelligence</span>
        </div>
        <h1 style={{ margin: '0 0 16px', fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.15, color: '#0f172a' }}>
          Smarter claims, faster recovery.<br />
          <span style={{ color: '#2563eb' }}>Built for rideshare drivers.</span>
        </h1>
        <p style={{ margin: '0 auto 28px', maxWidth: 560, color: '#475569', fontSize: '1rem', lineHeight: 1.7 }}>
          ClaimPilot walks you through every step of documenting a vehicle incident —
          from first description to final PDF — using AI to fill in the blanks and flag what's missing.
        </p>
        <button
          type="button"
          onClick={onGoToLogin}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
        >
          Sign in to get started →
        </button>
      </div>

      {/* How it works */}
      <div style={{ background: '#f8fafc', borderRadius: 20, padding: '28px 28px 20px', marginBottom: 28 }}>
        <p style={{ margin: '0 0 18px', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>How it works</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { step: '1', title: 'Describe the incident', detail: 'Type what happened in plain language. AI extracts structured fields.' },
            { step: '2', title: 'Upload evidence & answer questions', detail: 'Add photos and complete the guided interview to build a complete record.' },
            { step: '3', title: 'Export your packet', detail: 'Generate a professional narrative and export a print-ready PDF.' },
          ].map((s) => (
            <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>{s.step}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 3 }}>{s.title}</div>
                <div style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.5 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>Features</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 36 }}>
        {features.map((f) => (
          <div key={f.title} className="card" style={{ padding: '16px 18px', borderRadius: 16 }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 5 }}>{f.title}</div>
            <div style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.55 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 32 }}>
        <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 14 }}>Ready to document your claim?</p>
        <button
          type="button"
          onClick={onGoToLogin}
          style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 26px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
        >
          Sign in →
        </button>
      </div>
    </div>
  );
}
