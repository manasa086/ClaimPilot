import { useState } from 'react';
import type { IncidentReport } from '../types/incident';

interface ReportsHomeProps {
  reports: IncidentReport[];
  onStartNewReport: () => void;
  onContinueReport: (reportId: string) => void;
  onDeleteReport: (reportId: string) => void;
  readonly?: boolean;
}

function formatReportDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function readinessColor(score: number) {
  if (score >= 80) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

function computeReadiness(report: IncidentReport) {
  const missing: string[] = [];
  if (!report.title?.trim()) missing.push('Incident title');
  if (!report.vehicle?.trim()) missing.push('Vehicle information');
  if (!report.platformStatus?.trim()) missing.push('Platform status');
  if (!report.location?.trim()) missing.push('Incident location');
  if (!report.incidentType?.trim()) missing.push('Incident type');
  if (!report.description?.trim()) missing.push('Incident description');
  if (!report.photoUrls?.length) missing.push('Photos / Evidence');
  // 7 checkable items (interview not persisted) × 12 pts each
  return { score: Math.max(10, 100 - missing.length * 12), missing };
}

export default function ReportsHome({ reports, onStartNewReport, onContinueReport, onDeleteReport, readonly }: ReportsHomeProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    if (confirmingId === id) {
      onDeleteReport(id);
      setConfirmingId(null);
    } else {
      setConfirmingId(id);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <section className="card" style={{ padding: '20px 24px', borderRadius: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Claims overview</p>
            <h1 style={{ margin: '8px 0 6px', fontSize: '1.5rem', lineHeight: 1.2, fontWeight: 700 }}>Manage claims and keep every packet moving.</h1>
            <p style={{ margin: 0, color: '#64748b', maxWidth: 560, fontSize: '0.85rem', lineHeight: 1.5 }}>
              Track claim readiness, continue draft reports, and launch the next step in your claim workflow.
            </p>
          </div>
          {!readonly && (
            <button className="button-primary" type="button" onClick={onStartNewReport}>Start new claim</button>
          )}
        </div>
        {readonly && (
          <div style={{ marginTop: 14, background: '#f1f5f9', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', color: '#64748b' }}>
            Viewing in demo mode. <button onClick={onStartNewReport} style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Sign in</button> to create or edit claims.
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gap: '10px' }}>
        {reports.length === 0 ? (
          <div className="card" style={{ padding: '24px', borderRadius: 18, color: '#64748b', fontSize: '0.85rem' }}>
            No active claims yet. Create your first incident report now.
          </div>
        ) : (
          reports.map((report) => {
            const { score, missing } = computeReadiness(report);
            return (
              <article key={report.id} className="card" style={{ padding: '16px 20px', borderRadius: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{report.title}</div>
                    <div style={{ color: '#64748b', marginTop: 3, fontSize: '0.78rem' }}>
                      {formatReportDate(report.createdAt)} &nbsp;·&nbsp; {report.platformStatus}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="pill" style={{ background: report.status === 'Completed' ? '#dcfce7' : '#eef2ff', color: report.status === 'Completed' ? '#166534' : '#2563eb' }}>
                      {report.status}
                    </span>
                    <button className="button-secondary" type="button" onClick={() => onContinueReport(report.id)} style={{ fontSize: '0.8rem', padding: '7px 14px' }}>
                      {readonly ? 'View' : report.status === 'Completed' ? 'View' : 'Continue'}
                    </button>
                    {!readonly && confirmingId === report.id ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(report.id)}
                          style={{ background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, padding: '7px 12px', cursor: 'pointer', fontSize: '0.78rem' }}
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, color: '#64748b', fontWeight: 600, padding: '7px 10px', cursor: 'pointer', fontSize: '0.78rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : !readonly ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(report.id)}
                        title="Delete claim"
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        🗑
                      </button>
                    ) : null}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Readiness</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: readinessColor(score) }}>{score}%</span>
                  </div>
                  <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3 }}>
                    <div style={{ width: `${score}%`, height: '100%', borderRadius: 3, background: readinessColor(score), transition: 'width 0.3s ease' }} />
                  </div>
                  {missing.length > 0 && (
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: 5 }}>
                      Missing: {missing.join(', ')}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
