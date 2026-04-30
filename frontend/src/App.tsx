import { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import type { AppTab } from './components/AppShell';
import ReportsHome from './components/ReportsHome';
import ReportDashboard from './components/ReportDashboard';
import NewReportForm from './components/NewReportForm';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import type { IncidentReport } from './types/incident';
import { getStoredSession, verifySession, logout } from './utils/auth';
import type { AuthSession } from './utils/auth';
import { apiFetch } from './utils/apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

type ClaimsView = 'reports' | 'new-report' | 'dashboard';

async function fetchFromApi(path: string): Promise<IncidentReport[]> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('landing');

  // Live reports — only loaded when authenticated
  const [reports, setReports] = useState<IncidentReport[]>([]);
  // Demo reports — loaded from _dummy table, always public
  const [demoReports, setDemoReports] = useState<IncidentReport[]>([]);

  const [claimsView, setClaimsView] = useState<ClaimsView>('reports');
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  // Verify stored session on mount, always load demo data
  useEffect(() => {
    checkApiStatus();
    loadDemoReports();

    const stored = getStoredSession();
    if (!stored) {
      setAuthChecked(true);
      return;
    }
    verifySession(stored.sessionId).then((valid) => {
      if (valid) {
        setAuthSession(stored);
        setActiveTab('claims');
      }
      setAuthChecked(true);
    });
  }, []);

  // Load live reports whenever auth changes
  useEffect(() => {
    if (authSession) loadLiveReports();
  }, [authSession]);

  const checkApiStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`);
      setApiStatus(res.ok ? 'connected' : 'error');
    } catch {
      setApiStatus('error');
    }
  };

  const loadDemoReports = async () => {
    const data = await fetchFromApi('/api/demo/reports');
    setDemoReports(data);
  };

  const loadLiveReports = async () => {
    const data = await fetchFromApi('/api/reports');
    setReports(data);
  };

  const handleLoginSuccess = (session: AuthSession) => {
    setAuthSession(session);
    setActiveTab('claims');
    // Reset to list view so the user sees their live claims
    setClaimsView('reports');
    setSelectedReport(null);
  };

  const handleLogout = async () => {
    if (authSession) await logout(authSession.sessionId);
    setAuthSession(null);
    setActiveTab('landing');
    setReports([]);
    setSelectedReport(null);
    setClaimsView('reports');
  };

  const handleTabChange = (tab: AppTab) => setActiveTab(tab);

  // Source of truth for the claims tab depends on auth state
  const activeReports = authSession ? reports : demoReports;

  const handleStartNewReport = () => setClaimsView('new-report');

  const handleContinueReport = (reportId: string) => {
    const report = activeReports.find((r) => r.id === reportId);
    if (report) {
      setSelectedReport(report);
      setClaimsView('dashboard');
    }
  };

  const handleReportCreated = (newReport: IncidentReport) => {
    setReports((prev) => [newReport, ...prev]);
    setSelectedReport(newReport);
    setClaimsView('dashboard');
  };

  const handleReportUpdated = (updatedReport: IncidentReport) => {
    setReports((prev) => prev.map((r) => (r.id === updatedReport.id ? updatedReport : r)));
    setSelectedReport(updatedReport);
  };

  const handleBackToReports = () => {
    setClaimsView('reports');
    setSelectedReport(null);
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      await apiFetch(`/api/reports/${reportId}`, { method: 'DELETE' });
    } catch { /* remove from UI regardless */ }
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    if (selectedReport?.id === reportId) {
      setClaimsView('reports');
      setSelectedReport(null);
    }
  };

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fbff' }}>
        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading…</div>
      </div>
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      authSession={authSession}
      onLogout={handleLogout}
      onNewClaim={activeTab === 'claims' && !!authSession ? handleStartNewReport : undefined}
    >
      {activeTab === 'landing' && (
        <LandingPage onGoToLogin={() => handleTabChange('login')} />
      )}

      {activeTab === 'login' && (
        authSession ? (
          <div style={{ maxWidth: 420, margin: '48px auto', textAlign: 'center', color: '#64748b' }}>
            <p>You are already signed in as <strong>{authSession.userName}</strong>.</p>
            <button
              onClick={() => handleTabChange('claims')}
              style={{ marginTop: 12, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
            >
              Go to My Claims →
            </button>
          </div>
        ) : (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        )
      )}

      {activeTab === 'claims' && (
        <>
          <div style={{ marginBottom: '20px', textAlign: 'right' }}>
            <span style={{
              padding: '6px 12px', borderRadius: 9999, fontSize: '12px',
              background: apiStatus === 'connected' ? '#dcfce7' : apiStatus === 'error' ? '#fee2e2' : '#fef9c3',
              color: apiStatus === 'connected' ? '#166534' : apiStatus === 'error' ? '#991b1b' : '#92400e',
              border: '1px solid rgba(15, 23, 42, 0.08)',
            }}>
              API: {apiStatus === 'connected' ? 'Connected' : apiStatus === 'error' ? 'Error' : 'Checking...'}
            </span>
          </div>

          {claimsView === 'reports' && (
            <ReportsHome
              reports={activeReports}
              onStartNewReport={authSession ? handleStartNewReport : () => setActiveTab('login')}
              onContinueReport={handleContinueReport}
              onDeleteReport={authSession ? handleDeleteReport : () => {}}
              readonly={!authSession}
            />
          )}

          {authSession && claimsView === 'new-report' && (
            <NewReportForm onReportCreated={handleReportCreated} onCancel={handleBackToReports} />
          )}

          {claimsView === 'dashboard' && selectedReport && (
            <ReportDashboard
              report={selectedReport}
              onBack={handleBackToReports}
              onReportUpdated={handleReportUpdated}
              onDeleteReport={handleDeleteReport}
              readonly={!authSession}
            />
          )}

          {claimsView === 'dashboard' && !selectedReport && (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p>No report selected.</p>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

export default App;
