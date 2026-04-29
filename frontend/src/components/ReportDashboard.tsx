import { useEffect, useMemo, useRef, useState } from 'react';
import type { IncidentReport } from '../types/incident';
import { aiApi, type AiQuestion, type PhotoAnalysis, type Inconsistency } from '../utils/ai';
import { uploadPhoto, deletePhoto, fetchAsDataUrl, storageConfigured } from '../utils/supabase';

interface ReportDashboardProps {
  report: IncidentReport;
  onBack: () => void;
  onReportUpdated: (report: IncidentReport) => void;
  onDeleteReport: (reportId: string) => void;
  readonly?: boolean;
}

type SectionId = 'Overview' | 'Interview' | 'Evidence' | 'Timeline' | 'Claim Packet' | 'Review';

type EvidenceStatus = 'Complete' | 'Partial' | 'Missing';

interface EvidenceItem {
  label: string;
  status: EvidenceStatus;
  detail: string;
}

interface UploadedFile {
  name: string;
  dataUrl: string | null; // base64 — used for AI analysis and PDF export
  isImage: boolean;
  size: number;
  storagePath?: string;  // Supabase Storage path for deletion
  signedUrl?: string;    // Supabase signed URL for display when dataUrl not yet loaded
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const sidebarItems: SectionId[] = ['Overview', 'Interview', 'Evidence', 'Timeline', 'Claim Packet', 'Review'];

const defaultEvidence: EvidenceItem[] = [
  { label: "Driver's License", status: 'Missing', detail: '' },
  { label: 'Insurance Card', status: 'Missing', detail: '' },
  { label: 'Vehicle Photos', status: 'Missing', detail: '' },
  { label: 'Dash Cam / Video', status: 'Missing', detail: '' },
  { label: 'Witnesses Statement', status: 'Missing', detail: '' },
  { label: 'Trip Receipt', status: 'Missing', detail: '' },
];

const interviewQuestions = [
  { id: 'police', question: 'Did the police respond to the scene?', impact: 'High' },
  { id: 'injuries', question: 'Were there any injuries to yourself or others?', impact: 'High' },
  { id: 'witnesses', question: 'Were there witnesses present at the scene?', impact: 'Medium' },
  { id: 'dashcam', question: 'Was a dash cam recording during the incident?', impact: 'Medium' },
  { id: 'otherInsurance', question: "Was the other driver's insurance information collected?", impact: 'High' },
  { id: 'medical', question: 'Did anyone seek medical attention afterward?', impact: 'High' },
  { id: 'towed', question: 'Was the vehicle towed from the scene?', impact: 'Low' },
];

const answerOptions = ['Yes', 'No', 'Not sure'];

const incidentTypeOptions = [
  'Rear-end collision',
  'Side-impact (T-bone)',
  'Head-on collision',
  'Hit and run',
  'Sideswipe',
  'Parking lot incident',
  'Rollover',
  'Other',
];

const platformOptions = [
  'Uber trip active',
  'Lyft trip active',
  'Uber Eats delivery',
  'DoorDash delivery',
  'Personal vehicle',
  'Rental vehicle',
  'Other',
];

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'May 12, 2025 4:35 PM';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getClaimDetails(report: IncidentReport) {
  return {
    claimId: report.id.startsWith('CP-') ? report.id : `CP-${report.id.slice(-6)}`,
    date: report.createdAt ? formatDate(report.createdAt) : '',
    location: report.location || '',
    incidentType: report.incidentType || '',
    vehicle: report.vehicle || '',
    platform: report.platformStatus || '',
  };
}

function computeReportReadiness(
  report: IncidentReport,
  hasPhotos: boolean,
) {
  const missingItems: string[] = [];
  if (!report.title?.trim()) missingItems.push('Incident title');
  if (!report.vehicle?.trim()) missingItems.push('Vehicle information');
  if (!report.platformStatus?.trim()) missingItems.push('Platform status');
  if (!report.location?.trim()) missingItems.push('Incident location');
  if (!report.incidentType?.trim()) missingItems.push('Incident type');
  if (!report.description?.trim()) missingItems.push('Incident description');
  if (!hasPhotos) missingItems.push('Photos / Evidence');
  const raw = Math.max(10, 100 - missingItems.length * 12);
  // Without documents readiness is capped at 42%
  const readinessScore = hasPhotos ? raw : Math.min(raw, 42);
  return { readinessScore, missingItems };
}

function readinessColor(score: number) {
  if (score >= 80) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

function ReadinessBar({ score }: { score: number }) {
  const color = readinessColor(score);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Claim readiness</span>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color }}>{score}%</span>
      </div>
      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3 }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function impactBadge(impact: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    High: { bg: '#fee2e2', color: '#b91c1c' },
    Medium: { bg: '#fef3c7', color: '#92400e' },
    Low: { bg: '#f0fdf4', color: '#166534' },
  };
  const c = colors[impact] ?? colors.Medium;
  return (
    <span style={{ padding: '3px 8px', borderRadius: 9999, background: c.bg, color: c.color, fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
      {impact}
    </span>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Resolve field config ────────────────────────────────────────────────────

interface FieldConfig {
  label: string;
  type: 'text' | 'select' | 'textarea';
  placeholder?: string;
  options?: string[];
  reportField: keyof IncidentReport;
  hint?: string;
}

const resolveFieldConfig: Record<string, FieldConfig> = {
  'Incident title': {
    label: 'Claim Title',
    type: 'text',
    placeholder: 'e.g., 2026 Toyota Camry collision on Main St',
    reportField: 'title',
    hint: 'Give a short, descriptive name for this claim.',
  },
  'Vehicle information': {
    label: 'Vehicle',
    type: 'text',
    placeholder: 'e.g., 2026 Toyota Camry, White, License # ABC1234',
    reportField: 'vehicle',
    hint: 'Year, make, model, color, and license plate.',
  },
  'Platform status': {
    label: 'Platform / Trip Status',
    type: 'select',
    options: platformOptions,
    reportField: 'platformStatus',
    hint: 'What was the rideshare or delivery status at the time of the incident?',
  },
  'Incident location': {
    label: 'Incident Location',
    type: 'text',
    placeholder: 'e.g., 123 Main St & 5th Ave, Los Angeles, CA 90001',
    reportField: 'location',
    hint: 'Street intersection or full address where the incident occurred.',
  },
  'Incident type': {
    label: 'Type of Incident',
    type: 'select',
    options: incidentTypeOptions,
    reportField: 'incidentType',
    hint: 'Select the type that best describes what happened.',
  },
  'Incident description': {
    label: 'What happened?',
    type: 'textarea',
    placeholder:
      'Describe the incident in your own words. Include: what you were doing, what the other party did, the direction of travel, weather/road conditions, and any other relevant details.',
    reportField: 'description',
    hint: 'Be as detailed as possible. This is the narrative that will appear in your claim packet.',
  },
};

export default function ReportDashboard({ report, onBack, onReportUpdated, onDeleteReport, readonly }: ReportDashboardProps) {
  const [currentReport, setCurrentReport] = useState<IncidentReport>(report);
  const [draftStatus, setDraftStatus] = useState('Draft saved 2 min ago');
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('Overview');
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceItem[]>(defaultEvidence);
  const [isViewOnly, setIsViewOnly] = useState(report.status === 'Completed' || !!readonly);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [interviewAnswers, setInterviewAnswers] = useState<Record<string, string>>({});
  const [activityExpanded, setActivityExpanded] = useState(false);

  // Resolve modal
  const [resolveModal, setResolveModal] = useState<{ item: string; value: string } | null>(null);

  // Per-evidence-item uploaded files
  const [itemFiles, setItemFiles] = useState<Record<string, UploadedFile[]>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── AI state ──────────────────────────────────────────────────────────────
  const [aiQuestions, setAiQuestions] = useState<AiQuestion[]>([]);
  const [aiQuestionsLoading, setAiQuestionsLoading] = useState(false);
  const [aiQuestionsError, setAiQuestionsError] = useState<string | null>(null);
  const [aiQuestionsLoaded, setAiQuestionsLoaded] = useState(false);

  const [photoAnalyses, setPhotoAnalyses] = useState<Record<string, PhotoAnalysis>>({});

  const [aiNarrative, setAiNarrative] = useState('');
  const [aiNarrativeLoading, setAiNarrativeLoading] = useState(false);
  const [aiNarrativeError, setAiNarrativeError] = useState<string | null>(null);

  const [inconsistencies, setInconsistencies] = useState<Inconsistency[]>([]);
  const [inconsistencyLoading, setInconsistencyLoading] = useState(false);
  const [inconsistencyChecked, setInconsistencyChecked] = useState(false);

  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setCurrentReport(report);
    setIsViewOnly(report.status === 'Completed' || !!readonly);
  }, [report, readonly]);

  const details = getClaimDetails(currentReport);
  const hasPhotos = Object.values(itemFiles).some((files) => files.length > 0);
  const readiness = useMemo(
    () => computeReportReadiness(currentReport, hasPhotos),
    [currentReport, hasPhotos], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const riskFlags = useMemo(() => [
    { label: 'Passenger Onboard', impact: 'High', description: 'Increases claim complexity.' },
    { label: 'Injury Mentioned', impact: 'Medium', description: 'Potential bodily injury claim.' },
    { label: 'Disputed Fault', impact: 'High', description: 'Liability may be challenged.' },
  ], []);

  const sidebarBadges: Record<SectionId, string> = useMemo(() => ({
    Overview: '',
    Interview: `${Object.keys(interviewAnswers).length}/${interviewQuestions.length + aiQuestions.length}`,
    Evidence: `${evidenceStatus.filter((e) => e.status === 'Complete').length}/${evidenceStatus.length}`,
    Timeline: '4',
    'Claim Packet': `${readiness.readinessScore}%`,
    Review: readiness.missingItems.length > 0 ? `${readiness.missingItems.length} pending` : 'Ready',
  }), [interviewAnswers, evidenceStatus, readiness, aiQuestions]);

  const updateReportField = (field: keyof IncidentReport, value: string) => {
    setCurrentReport((prev) => ({ ...prev, [field]: value }));
  };

  // Open resolve modal with pre-filled current value
  const openResolveModal = (item: string) => {
    if (item === 'Supporting evidence') {
      setActiveSection('Evidence');
      return;
    }
    const config = resolveFieldConfig[item];
    if (!config) return;
    const current = (currentReport[config.reportField] as string) || '';
    setResolveModal({ item, value: current });
  };

  const submitResolveModal = () => {
    if (!resolveModal || !resolveModal.value.trim()) return;
    const config = resolveFieldConfig[resolveModal.item];
    if (config) updateReportField(config.reportField, resolveModal.value.trim());
    setResolveModal(null);
  };

  // ── AI handlers ───────────────────────────────────────────────────────────

  const handleRewriteDescription = async () => {
    if (!resolveModal?.value.trim() || rewriteLoading) return;
    setRewriteLoading(true);
    const res = await aiApi.rewrite(resolveModal.value);
    setRewriteLoading(false);
    if (res.result && res.result !== resolveModal.value) {
      setResolveModal((prev) => prev ? { ...prev, value: res.result as string } : null);
    }
    if (!res.aiUsed && res.error) {
      // Surface error inline in the modal — the value stays unchanged as fallback
      alert(`AI rewrite: ${res.error}\nYour original text is kept.`);
    }
  };

  const handleLoadAiQuestions = async () => {
    if (aiQuestionsLoaded || aiQuestionsLoading) return;
    setAiQuestionsLoading(true);
    setAiQuestionsError(null);
    const existingQs = interviewQuestions.map((q) => q.question).join('; ');
    const context = [
      currentReport.vehicle && `Vehicle: ${currentReport.vehicle}`,
      currentReport.incidentType && `Incident type: ${currentReport.incidentType}`,
      currentReport.location && `Location: ${currentReport.location}`,
      currentReport.description && `Description: ${currentReport.description}`,
      `Already asked (do not repeat): ${existingQs}`,
    ].filter(Boolean).join('. ');
    const res = await aiApi.questions(context || 'General vehicle incident');
    // Only surface the error if AI produced no questions at all
    setAiQuestionsError(!res.aiUsed && (res.result ?? []).length === 0 ? (res.error ?? null) : null);
    setAiQuestions(res.result ?? []);
    setAiQuestionsLoading(false);
    setAiQuestionsLoaded(true);
  };

  const handleAnalyzePhoto = async (evidenceLabel: string, file: UploadedFile) => {
    if (!file.isImage || !file.dataUrl) return;
    const key = `${evidenceLabel}::${file.name}`;
    const res = await aiApi.analyzePhoto(file.dataUrl, evidenceLabel);
    setPhotoAnalyses((prev) => ({ ...prev, [key]: res.result }));
  };

  const handleGenerateNarrative = async () => {
    setAiNarrativeLoading(true);
    setAiNarrativeError(null);
    const context = [
      `Claim ID: ${details.claimId}`,
      `Date: ${details.date}`,
      details.location && `Location: ${details.location}`,
      details.incidentType && `Incident Type: ${details.incidentType}`,
      details.vehicle && `Vehicle: ${details.vehicle}`,
      details.platform && `Platform: ${details.platform}`,
      currentReport.description && `Description: ${currentReport.description}`,
      evidenceStatus.filter((e) => e.status !== 'Missing').length > 0 &&
        `Evidence collected: ${evidenceStatus.filter((e) => e.status !== 'Missing').map((e) => e.label).join(', ')}`,
      Object.keys(interviewAnswers).length > 0 &&
        `Interview: ${interviewQuestions.filter((q) => interviewAnswers[q.id]).map((q) => `${q.question} → ${interviewAnswers[q.id]}`).join('; ')}`,
    ].filter(Boolean).join('\n');
    const res = await aiApi.narrative(context);
    setAiNarrative(res.result ?? '');
    setAiNarrativeError(res.aiUsed ? null : (res.error ?? null));
    setAiNarrativeLoading(false);
  };

  const handleCheckInconsistencies = async () => {
    if (!currentReport.description?.trim() || inconsistencyLoading) return;
    setInconsistencyLoading(true);
    const res = await aiApi.checkInconsistencies(currentReport.description, interviewAnswers);
    setInconsistencies(res.result ?? []);
    setInconsistencyChecked(true);
    setInconsistencyLoading(false);
  };

  // Auto-load AI questions when Interview tab is first visited
  useEffect(() => {
    if (activeSection === 'Interview') handleLoadAiQuestions();
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore photos from Supabase when dashboard opens ────────────────────
  useEffect(() => {
    const stored = report.photoUrls;
    if (!stored?.length) return;

    const byLabel: Record<string, UploadedFile[]> = {};
    for (const p of stored) {
      if (!byLabel[p.evidenceLabel]) byLabel[p.evidenceLabel] = [];
      byLabel[p.evidenceLabel].push({
        name: p.name,
        dataUrl: null,
        isImage: p.isImage,
        size: p.size,
        storagePath: p.path,
        signedUrl: p.signedUrl,
      });
    }
    setItemFiles(byLabel);
    setEvidenceStatus((s) =>
      s.map((e) => {
        const files = byLabel[e.label];
        if (!files?.length) return e;
        return { ...e, status: 'Complete', detail: `${files.length} file(s) uploaded` };
      }),
    );

    // Fetch base64 data URLs for images (needed for AI analysis and PDF export)
    for (const [label, files] of Object.entries(byLabel)) {
      for (const f of files) {
        if (f.isImage && f.signedUrl) {
          const { signedUrl, storagePath } = f;
          fetchAsDataUrl(signedUrl).then((dataUrl) => {
            if (!dataUrl) return;
            setItemFiles((prev) => ({
              ...prev,
              [label]: (prev[label] || []).map((file) =>
                file.storagePath === storagePath ? { ...file, dataUrl } : file,
              ),
            }));
          });
        }
      }
    }
  }, [report.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helper: build photo_urls array from current itemFiles state ──────────
  const buildPhotoUrls = (files: Record<string, UploadedFile[]>) =>
    Object.entries(files).flatMap(([evidenceLabel, list]) =>
      list
        .filter((f) => f.storagePath && f.signedUrl)
        .map((f) => ({
          evidenceLabel,
          name: f.name,
          path: f.storagePath!,
          signedUrl: f.signedUrl!,
          size: f.size,
          isImage: f.isImage,
        })),
    );

  const patchPhotoUrls = async (files: Record<string, UploadedFile[]>) => {
    const photoUrls = buildPhotoUrls(files);
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/reports/${currentReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrls }),
      });
    } catch { /* ignore — photos are uploaded, URL persistence is best-effort */ }
  };

  // ── File upload: convert to base64 + upload to Supabase ──────────────────
  const handleFileUpload = async (evidenceLabel: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: UploadedFile[] = await Promise.all(
      Array.from(files).map(async (f) => {
        const isImage = f.type.startsWith('image/');
        const dataUrl = isImage ? await readAsDataUrl(f) : null;
        const stored = storageConfigured ? await uploadPhoto(currentReport.id, evidenceLabel, f) : null;
        return {
          name: f.name,
          size: f.size,
          isImage,
          dataUrl,
          storagePath: stored?.path,
          signedUrl: stored?.signedUrl,
        };
      }),
    );

    const existingFiles = itemFiles[evidenceLabel] || [];
    const mergedFiles = [...existingFiles, ...newFiles];
    const newItemFiles = { ...itemFiles, [evidenceLabel]: mergedFiles };

    setItemFiles(newItemFiles);
    setEvidenceStatus((s) =>
      s.map((e) =>
        e.label === evidenceLabel
          ? { ...e, status: 'Complete', detail: `${mergedFiles.length} file(s) uploaded` }
          : e,
      ),
    );

    await patchPhotoUrls(newItemFiles);

    for (const file of newFiles) {
      if (file.isImage && file.dataUrl) handleAnalyzePhoto(evidenceLabel, file);
    }
  };

  const removeFile = async (evidenceLabel: string, idx: number) => {
    const fileToRemove = (itemFiles[evidenceLabel] || [])[idx];
    const newFiles = (itemFiles[evidenceLabel] || []).filter((_, i) => i !== idx);
    const newItemFiles = { ...itemFiles, [evidenceLabel]: newFiles };

    setItemFiles(newItemFiles);
    setEvidenceStatus((s) =>
      s.map((e) =>
        e.label === evidenceLabel
          ? newFiles.length === 0
            ? { ...e, status: 'Missing', detail: '' }
            : { ...e, status: 'Complete', detail: `${newFiles.length} file(s) uploaded` }
          : e,
      ),
    );

    if (fileToRemove?.storagePath) deletePhoto(fileToRemove.storagePath);
    await patchPhotoUrls(newItemFiles);
  };

  const handleSaveDraft = async () => {
    if (!currentReport.id) return;
    setSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/reports/${currentReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentReport, status: currentReport.status || 'Draft' }),
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentReport(data.data);
        onReportUpdated(data.data);
        setDraftStatus('Draft saved just now');
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleFinishClaim = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/reports/${currentReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentReport, status: 'Completed' }),
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentReport(data.data);
        onReportUpdated(data.data);
        setIsViewOnly(true);
        setDraftStatus('Claim completed');
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  // Export — only user-provided information, with actual images embedded as base64
  const handleExportPdf = () => {
    const answeredQuestions = interviewQuestions.filter((q) => interviewAnswers[q.id]);
    const collectedEvidence = evidenceStatus.filter((e) => e.status !== 'Missing');

    const buildEvidenceSection = (e: EvidenceItem) => {
      const files = itemFiles[e.label] || [];
      const images = files.filter((f) => f.isImage && (f.dataUrl ?? f.signedUrl));
      const docs = files.filter((f) => !f.isImage);

      const imageGrid = images.length > 0
        ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px">
            ${images.map((f) => `<div style="text-align:center">
              <img src="${f.dataUrl}" alt="${f.name}" style="width:220px;height:165px;object-fit:cover;border-radius:6px;border:1px solid #ccc;display:block" />
              <div style="font-size:10px;color:#666;margin-top:4px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</div>
            </div>`).join('')}
          </div>`
        : '';

      const docList = docs.length > 0
        ? `<div style="margin-top:8px;font-size:12px;color:#555">
            ${docs.map((f) => `<div>&#128196; ${f.name}</div>`).join('')}
          </div>`
        : '';

      const noFiles = files.length === 0
        ? `<div style="font-size:12px;color:#888;margin-top:6px">${e.detail || e.status}</div>`
        : '';

      return `
        <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #eee">
          <div style="font-weight:700;font-size:13px">${e.label}</div>
          ${imageGrid}${docList}${noFiles}
        </div>`;
    };

    const interviewRows = answeredQuestions
      .map((q) => `<tr><td>${q.question}</td><td style="font-weight:600">${interviewAnswers[q.id]}</td></tr>`)
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Incident Report – ${details.claimId}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:860px;margin:40px auto;color:#1a1a1a;font-size:13px;line-height:1.6}
  h1{font-size:20px;border-bottom:2px solid #1a1a1a;padding-bottom:8px;margin-bottom:24px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#444;margin:28px 0 12px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;margin-bottom:12px}
  .field .label{font-weight:700;font-size:11px;text-transform:uppercase;color:#666;letter-spacing:.05em}
  .field .value{margin-top:3px;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px}
  td,th{padding:8px 10px;border:1px solid #ddd;text-align:left;vertical-align:top}
  th{background:#f5f5f5;font-weight:700;font-size:11px;text-transform:uppercase;color:#555}
  .description{background:#f9f9f9;border:1px solid #e0e0e0;border-radius:4px;padding:12px;font-size:13px;line-height:1.7;white-space:pre-wrap}
  footer{margin-top:48px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#888;display:flex;justify-content:space-between}
  @media print{body{margin:20px}button{display:none}}
</style>
</head>
<body>
<h1>Incident Report</h1>

<h2>Incident Details</h2>
<div class="grid">
  <div class="field"><div class="label">Reference Number</div><div class="value">${details.claimId}</div></div>
  <div class="field"><div class="label">Date &amp; Time of Incident</div><div class="value">${details.date}</div></div>
  ${details.location ? `<div class="field"><div class="label">Location</div><div class="value">${details.location}</div></div>` : ''}
  ${details.incidentType ? `<div class="field"><div class="label">Type of Incident</div><div class="value">${details.incidentType}</div></div>` : ''}
  ${details.vehicle ? `<div class="field"><div class="label">Vehicle</div><div class="value">${details.vehicle}</div></div>` : ''}
  ${details.platform ? `<div class="field"><div class="label">Platform / Trip Status</div><div class="value">${details.platform}</div></div>` : ''}
</div>

${aiNarrative ? `
<h2>Incident Narrative</h2>
<div class="description">${aiNarrative}</div>
` : currentReport.description ? `
<h2>Incident Description</h2>
<div class="description">${currentReport.description}</div>
` : ''}

${collectedEvidence.length > 0 ? `
<h2>Evidence &amp; Photos</h2>
${collectedEvidence.map(buildEvidenceSection).join('')}
` : ''}

${answeredQuestions.length > 0 ? `
<h2>Interview Notes</h2>
<table>
  <tr><th>Question</th><th>Response</th></tr>
  ${interviewRows}
</table>
` : ''}

<footer>
  <span>Prepared by: Jamie M. — Claim Advisor</span>
  <span>Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
</footer>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  };

  // ── Section renderers ──────────────────────────────────────────────────────

  const renderOverview = () => (
    <div style={{ display: 'grid', gap: '12px' }}>
      {/* Row 1: Readiness + Incident Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
          <p style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>Claim Readiness</p>
          <ReadinessBar score={readiness.readinessScore} />
          <p style={{ margin: '10px 0 0', color: '#64748b', lineHeight: 1.5, fontSize: '0.82rem' }}>
            Complete missing items and evidence to strengthen your packet before export.
          </p>
          <button className="button-secondary" type="button" onClick={() => setActiveSection('Review')} style={{ marginTop: 12, fontSize: '0.82rem', padding: '7px 12px' }}>
            View readiness details
          </button>
        </div>

        <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ margin: 0, color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>Incident Summary</p>
            <button type="button" onClick={() => setShowSummaryModal(true)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}>
              View full summary →
            </button>
          </div>
          <div style={{ display: 'grid', gap: '8px', color: '#334155', fontSize: '0.82rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><div style={{ fontWeight: 700 }}>Date / Time</div><div style={{ color: '#64748b', marginTop: 2 }}>{details.date}</div></div>
              <div><div style={{ fontWeight: 700 }}>Location</div><div style={{ color: '#64748b', marginTop: 2 }}>{details.location || <span style={{ color: '#dc2626' }}>Not set</span>}</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><div style={{ fontWeight: 700 }}>Incident Type</div><div style={{ color: '#64748b', marginTop: 2 }}>{details.incidentType || <span style={{ color: '#dc2626' }}>Not set</span>}</div></div>
              <div><div style={{ fontWeight: 700 }}>Platform</div><div style={{ color: '#64748b', marginTop: 2 }}>{details.platform || <span style={{ color: '#dc2626' }}>Not set</span>}</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Missing info + Risk Flags */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>Missing Information</p>
            <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{readiness.missingItems.length} items</span>
          </div>
          {readiness.missingItems.length === 0 ? (
            <p style={{ color: '#16a34a', fontSize: '0.83rem', margin: 0, fontWeight: 600 }}>All items complete — ready to export.</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {readiness.missingItems.map((item) => (
                <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: '#fef9f0', borderRadius: 10, padding: '10px 12px', border: '1px solid #fed7aa' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.83rem' }}>{item}</div>
                    <div style={{ color: '#64748b', marginTop: 1, fontSize: '0.77rem' }}>Required for claim packet</div>
                  </div>
                  <button className="button-primary" type="button" onClick={() => openResolveModal(item)} disabled={isViewOnly} style={{ fontSize: '0.77rem', padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    Resolve
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>Risk Flags</p>
            <span style={{ color: '#475569', fontSize: '0.82rem' }}>{riskFlags.length} flags</span>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {riskFlags.map((flag) => (
              <div key={flag.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.83rem' }}>{flag.label}</div>
                  <div style={{ color: '#64748b', marginTop: 1, fontSize: '0.77rem' }}>{flag.description}</div>
                </div>
                {impactBadge(flag.impact)}
              </div>
            ))}
          </div>
          {/* AI inconsistency check */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: inconsistencies.length > 0 ? 10 : 0 }}>
              <span style={{ fontSize: '0.83rem', fontWeight: 700 }}>AI Inconsistency Check</span>
              {!isViewOnly && (
                <button
                  type="button"
                  onClick={handleCheckInconsistencies}
                  disabled={inconsistencyLoading || !currentReport.description?.trim()}
                  style={{ background: '#7c3aed', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, padding: '5px 12px', cursor: inconsistencyLoading || !currentReport.description?.trim() ? 'not-allowed' : 'pointer', fontSize: '0.77rem', opacity: !currentReport.description?.trim() ? 0.5 : 1 }}
                >
                  {inconsistencyLoading ? 'Checking…' : inconsistencyChecked ? 'Re-check' : 'Check with AI'}
                </button>
              )}
            </div>
            {inconsistencyChecked && inconsistencies.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>No inconsistencies found.</div>
            )}
            {inconsistencies.length > 0 && (
              <div style={{ display: 'grid', gap: '6px' }}>
                {inconsistencies.map((inc, i) => (
                  <div key={i} style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#92400e', flex: 1 }}><strong>{inc.field}:</strong> {inc.issue}</div>
                      {impactBadge(inc.severity)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!currentReport.description?.trim() && (
              <div style={{ fontSize: '0.77rem', color: '#94a3b8' }}>Add an incident description to enable AI inconsistency check.</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Evidence overview */}
      <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>Evidence Status</p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ color: '#475569', fontSize: '0.82rem' }}>{evidenceStatus.filter((e) => e.status !== 'Missing').length} of {evidenceStatus.length} added</span>
            <button className="button-primary" type="button" onClick={() => setActiveSection('Evidence')} style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
              Upload Files
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {evidenceStatus.map((item) => (
            <div key={item.label} style={{ borderRadius: 10, padding: '10px 12px', background: '#f8fafc', border: `1px solid ${item.status === 'Complete' ? '#bbf7d0' : item.status === 'Partial' ? '#fde68a' : '#e2e8f0'}` }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{item.label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{item.detail || (item.status === 'Missing' ? 'Not added' : item.status)}</span>
                <span style={{ padding: '2px 7px', borderRadius: 9999, background: item.status === 'Complete' ? '#dcfce7' : item.status === 'Partial' ? '#fef3c7' : '#fee2e2', color: item.status === 'Complete' ? '#166534' : item.status === 'Partial' ? '#92400e' : '#b91c1c', fontWeight: 700, fontSize: '0.7rem' }}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setActivityExpanded(!activityExpanded)} style={{ marginTop: 10, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}>
          {activityExpanded ? 'Hide activity' : 'View recent activity'}
        </button>
        {activityExpanded && (
          <div style={{ marginTop: 8, color: '#475569', display: 'grid', gap: '6px', fontSize: '0.8rem' }}>
            <div>May 15, 2025 · Added answer to "What happened?"</div>
            <div>May 14, 2025 · Uploaded photo: Vehicle Damage - Rear</div>
          </div>
        )}
      </div>
    </div>
  );

  const allInterviewQuestions = useMemo(
    () => [...interviewQuestions, ...aiQuestions],
    [aiQuestions],
  );

  const renderInterview = () => (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Incident Interview</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.83rem', color: '#64748b' }}>{Object.keys(interviewAnswers).length} of {allInterviewQuestions.length} answered</span>
            {!aiQuestionsLoaded && (
              <button type="button" onClick={handleLoadAiQuestions} disabled={aiQuestionsLoading} style={{ background: '#7c3aed', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, padding: '4px 10px', cursor: aiQuestionsLoading ? 'wait' : 'pointer', fontSize: '0.75rem' }}>
                {aiQuestionsLoading ? 'Loading…' : 'Load AI questions'}
              </button>
            )}
          </div>
        </div>
        {aiQuestionsError && aiQuestions.length === 0 && (
          <div style={{ margin: '0 0 10px', padding: '6px 10px', background: '#fee2e2', borderRadius: 8, fontSize: '0.78rem', color: '#b91c1c' }}>
            {aiQuestionsError} — showing standard questions only.
          </div>
        )}
        <p style={{ margin: '4px 0 16px', color: '#64748b', fontSize: '0.83rem' }}>Answer these key questions to strengthen your claim packet.</p>
        <div style={{ display: 'grid', gap: '10px' }}>
          {allInterviewQuestions.map((q) => (
            <div key={q.id} style={{ background: '#f8fafc', borderRadius: 12, padding: '13px 15px', border: interviewAnswers[q.id] ? '1px solid #bae6fd' : '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: '0.87rem', color: '#0f172a', flex: 1 }}>
                  {q.question}
                  {q.id.startsWith('ai_') && (
                    <span style={{ marginLeft: 8, fontSize: '0.68rem', background: '#ede9fe', color: '#7c3aed', padding: '1px 6px', borderRadius: 9999, fontWeight: 700 }}>AI</span>
                  )}
                </div>
                {impactBadge(q.impact)}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {answerOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={isViewOnly}
                    onClick={() => setInterviewAnswers((prev) => ({ ...prev, [q.id]: option }))}
                    style={{
                      background: interviewAnswers[q.id] === option ? '#2563eb' : '#fff',
                      color: interviewAnswers[q.id] === option ? '#fff' : '#0f172a',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '7px 16px',
                      cursor: isViewOnly ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                    }}
                  >
                    {option}
                  </button>
                ))}
                {interviewAnswers[q.id] && (
                  <button type="button" disabled={isViewOnly} onClick={() => setInterviewAnswers((prev) => { const n = { ...prev }; delete n[q.id]; return n; })} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.77rem', padding: '7px 6px' }}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEvidence = () => (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Evidence &amp; Photo Upload</p>
          <span style={{ fontSize: '0.83rem', color: '#64748b' }}>{evidenceStatus.filter((e) => e.status === 'Complete').length} of {evidenceStatus.length} complete</span>
        </div>
        <p style={{ margin: '4px 0 16px', color: '#64748b', fontSize: '0.83rem' }}>
          Upload photos and documents for each evidence item. Vehicle photos are the most important piece of a claim.
        </p>
        <div style={{ display: 'grid', gap: '12px' }}>
          {evidenceStatus.map((item) => {
            const files = itemFiles[item.label] || [];
            return (
              <div key={item.label} style={{ borderRadius: 12, border: `1px solid ${item.status === 'Complete' ? '#bbf7d0' : item.status === 'Partial' ? '#fde68a' : '#e2e8f0'}`, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#f8fafc' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.87rem' }}>{item.label}</div>
                    <div style={{ color: '#64748b', marginTop: 2, fontSize: '0.78rem' }}>
                      {files.length > 0 ? `${files.length} file(s) uploaded` : (item.detail || (item.status === 'Missing' ? 'No files yet' : item.status))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 9999, background: item.status === 'Complete' ? '#dcfce7' : item.status === 'Partial' ? '#fef3c7' : '#fee2e2', color: item.status === 'Complete' ? '#166534' : item.status === 'Partial' ? '#92400e' : '#b91c1c', fontWeight: 700, fontSize: '0.73rem' }}>
                      {item.status}
                    </span>
                    {!isViewOnly && (
                      <>
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*,application/pdf,.doc,.docx"
                          style={{ display: 'none' }}
                          ref={(el) => { fileInputRefs.current[item.label] = el; }}
                          onChange={(e) => handleFileUpload(item.label, e.target.files)}
                        />
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() => fileInputRefs.current[item.label]?.click()}
                          style={{ fontSize: '0.77rem', padding: '6px 12px' }}
                        >
                          {files.length > 0 ? 'Add more' : 'Upload'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {files.length > 0 && (
                  <div style={{ padding: '10px 14px', background: '#fff', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {files.map((f, idx) => {
                        const analysisKey = `${item.label}::${f.name}`;
                        const analysis = photoAnalyses[analysisKey];
                        const severityColor: Record<string, string> = { None: '#16a34a', Minor: '#d97706', Moderate: '#dc2626', Severe: '#7f1d1d', Unknown: '#64748b' };
                        return (
                          <div key={idx} style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px', maxWidth: 90 }}>
                            {(f.dataUrl ?? f.signedUrl) ? (
                              <img src={f.dataUrl ?? f.signedUrl} alt={f.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                            ) : (
                              <div style={{ width: 72, height: 72, background: '#f1f5f9', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <span style={{ fontSize: '1.4rem' }}>📄</span>
                                <span style={{ fontSize: '0.6rem', color: '#64748b', textAlign: 'center', padding: '0 4px', wordBreak: 'break-all' }}>{f.name.split('.').pop()?.toUpperCase()}</span>
                              </div>
                            )}
                            {analysis ? (
                              <div style={{ fontSize: '0.62rem', textAlign: 'center', color: severityColor[analysis.severity] ?? '#64748b', fontWeight: 700 }} title={`${analysis.analysis}${analysis.notes ? ' — ' + analysis.notes : ''}`}>
                                {analysis.severity} {analysis.confidence > 0 ? `(${analysis.confidence}%)` : ''}
                              </div>
                            ) : f.isImage ? (
                              <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Analyzing…</div>
                            ) : null}
                            <div style={{ fontSize: '0.65rem', color: '#64748b', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</div>
                            <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{formatBytes(f.size)}</div>
                            {!isViewOnly && (
                              <button
                                type="button"
                                onClick={() => removeFile(item.label, idx)}
                                style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderTimeline = () => {
    const events = [
      { date: details.date, title: 'Claim created', desc: `Incident report opened for ${details.incidentType || 'incident'}.`, color: '#2563eb' },
      { date: 'May 13, 2025', title: 'Evidence uploaded', desc: "Driver's License and Insurance Card added.", color: '#16a34a' },
      { date: 'May 14, 2025', title: 'Vehicle photos added', desc: '6 photos of vehicle damage uploaded.', color: '#16a34a' },
      { date: 'May 15, 2025 · Recent', title: 'Interview answered', desc: 'Responded to "What happened?" question.', color: '#d97706' },
    ];
    return (
      <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
        <p style={{ margin: '0 0 18px', fontWeight: 700, fontSize: '0.95rem' }}>Claim Timeline</p>
        <div style={{ position: 'relative', paddingLeft: 20 }}>
          <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: '#e2e8f0', borderRadius: 1 }} />
          <div style={{ display: 'grid', gap: '16px' }}>
            {events.map((event, i) => (
              <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', position: 'relative' }}>
                <div style={{ position: 'absolute', left: -20, top: 3, width: 10, height: 10, borderRadius: '50%', background: event.color, border: '2px solid #fff', boxShadow: `0 0 0 2px ${event.color}` }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{event.title}</div>
                  <div style={{ color: '#64748b', fontSize: '0.79rem', marginTop: 1 }}>{event.desc}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.74rem', marginTop: 2 }}>{event.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderClaimPacket = () => (
    <div style={{ display: 'grid', gap: '12px' }}>
      {/* AI Narrative generator */}
      <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>
              AI Narrative
              <span style={{ marginLeft: 8, fontSize: '0.7rem', background: '#ede9fe', color: '#7c3aed', padding: '2px 7px', borderRadius: 9999, fontWeight: 700 }}>GPT-4o</span>
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Generate a professional claim narrative ready for insurance submission.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateNarrative}
            disabled={aiNarrativeLoading}
            style={{ background: '#7c3aed', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 600, padding: '9px 16px', cursor: aiNarrativeLoading ? 'wait' : 'pointer', fontSize: '0.83rem', opacity: aiNarrativeLoading ? 0.7 : 1, whiteSpace: 'nowrap' }}
          >
            {aiNarrativeLoading ? 'Generating…' : aiNarrative ? 'Regenerate' : 'Generate Narrative'}
          </button>
        </div>
        {aiNarrativeError && (
          <div style={{ padding: '8px 12px', background: '#fee2e2', borderRadius: 8, fontSize: '0.8rem', color: '#b91c1c', marginBottom: 8 }}>
            {aiNarrativeError} — export will use the raw description as fallback.
          </div>
        )}
        {aiNarrative ? (
          <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '12px 14px', fontSize: '0.85rem', lineHeight: 1.7, color: '#1e1b4b', whiteSpace: 'pre-wrap' }}>
            {aiNarrative}
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
            {aiNarrativeLoading ? 'Writing professional narrative…' : 'Click "Generate Narrative" to create a polished, insurance-ready summary. This will be included in the exported PDF.'}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Claim Packet Preview</p>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>This is what will be included in your exported document.</p>
          </div>
          <button className="button-primary" type="button" onClick={handleExportPdf} style={{ fontSize: '0.83rem', padding: '9px 16px' }}>
            Export / Print PDF
          </button>
        </div>
        <div style={{ display: 'grid', gap: '14px', color: '#334155', fontSize: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              ['Reference Number', details.claimId],
              ['Date of Incident', details.date],
              ['Location', details.location || '—'],
              ['Incident Type', details.incidentType || '—'],
              ['Vehicle', details.vehicle || '—'],
              ['Platform Status', details.platform || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ marginTop: 3 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Description</div>
            <div style={{ color: currentReport.description ? '#334155' : '#94a3b8', fontSize: '0.85rem', lineHeight: 1.6, background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
              {currentReport.description || 'No description provided yet.'}
            </div>
          </div>
          {evidenceStatus.filter((e) => e.status !== 'Missing').length > 0 && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Evidence Collected</div>
              <div style={{ display: 'grid', gap: '5px' }}>
                {evidenceStatus.filter((e) => e.status !== 'Missing').map((e) => (
                  <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span>{e.label}</span>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{e.detail || e.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(interviewAnswers).length > 0 && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Interview Notes</div>
              <div style={{ display: 'grid', gap: '5px' }}>
                {interviewQuestions.filter((q) => interviewAnswers[q.id]).map((q) => (
                  <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.82rem' }}>
                    <span style={{ color: '#64748b', flex: 1 }}>{q.question}</span>
                    <span style={{ fontWeight: 600 }}>{interviewAnswers[q.id]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderReview = () => (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
        <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '0.95rem' }}>Final Review</p>
        <ReadinessBar score={readiness.readinessScore} />
        {readiness.readinessScore >= 80 ? (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', color: '#166534', fontSize: '0.85rem', fontWeight: 600 }}>
            Claim packet is ready to submit.
          </div>
        ) : (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fefce8', borderRadius: 10, border: '1px solid #fde047', color: '#92400e', fontSize: '0.85rem', fontWeight: 600 }}>
            Complete the items below before finishing the claim.
          </div>
        )}
      </div>

      {readiness.missingItems.length > 0 && (
        <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
          <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '0.9rem' }}>Items to resolve</p>
          <div style={{ display: 'grid', gap: '8px' }}>
            {readiness.missingItems.map((item) => (
              <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: '#fef9f0', borderRadius: 10, padding: '10px 12px', border: '1px solid #fed7aa' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item}</div>
                  <div style={{ color: '#64748b', marginTop: 1, fontSize: '0.78rem' }}>Required for claim packet</div>
                </div>
                <button className="button-primary" type="button" onClick={() => openResolveModal(item)} disabled={isViewOnly} style={{ fontSize: '0.78rem', padding: '6px 10px', whiteSpace: 'nowrap' }}>
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isViewOnly && (
        <div className="card" style={{ padding: '18px', borderRadius: 16 }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '0.9rem' }}>Complete this claim</p>
          <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '0.83rem' }}>Once finished, the claim is locked in view-only mode. Export the packet first.</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="button-secondary" type="button" onClick={handleExportPdf} style={{ fontSize: '0.85rem' }}>Export packet first</button>
            <button type="button" onClick={handleFinishClaim} disabled={saving} style={{ background: '#16a34a', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 600, padding: '9px 18px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Finishing…' : 'Finish & lock claim'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'Overview': return renderOverview();
      case 'Interview': return renderInterview();
      case 'Evidence': return renderEvidence();
      case 'Timeline': return renderTimeline();
      case 'Claim Packet': return renderClaimPacket();
      case 'Review': return renderReview();
      default: return null;
    }
  };

  // Resolve modal field config for current item
  const resolveConfig = resolveModal ? resolveFieldConfig[resolveModal.item] : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '14px' }}>
      {/* Sidebar — no duplicate ReadinessBar here */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ padding: '14px 16px', borderRadius: 14, background: '#0f172a', color: '#fff' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{details.claimId}</div>
          <div style={{ fontSize: '0.77rem', color: '#94a3b8', marginTop: 2 }}>{currentReport.status}</div>
        </div>

        <nav style={{ display: 'grid', gap: '4px' }}>
          {sidebarItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveSection(item)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                borderRadius: 12,
                border: item === activeSection ? '1px solid #bae6fd' : '1px solid transparent',
                background: item === activeSection ? '#e0f2fe' : '#fff',
                color: item === activeSection ? '#0369a1' : '#334155',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
              }}
            >
              <span>{item}</span>
              {sidebarBadges[item] && (
                <span style={{ fontSize: '0.72rem', background: item === activeSection ? '#bae6fd' : '#f1f5f9', color: item === activeSection ? '#0369a1' : '#64748b', padding: '1px 7px', borderRadius: 9999, fontWeight: 600 }}>
                  {sidebarBadges[item]}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="card" style={{ padding: '14px 16px', borderRadius: 14, fontSize: '0.8rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 7, fontSize: '0.83rem' }}>Claim Info</div>
          <div style={{ display: 'grid', gap: 6, color: '#475569' }}>
            <div><strong>ID:</strong> {details.claimId}</div>
            <div><strong>Vehicle:</strong> {currentReport.vehicle || '—'}</div>
            <div><strong>Platform:</strong> {details.platform || '—'}</div>
            <div><strong>Status:</strong> <span style={{ color: isViewOnly ? '#16a34a' : '#d97706', fontWeight: 700 }}>{isViewOnly ? 'Completed' : currentReport.status}</span></div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <section style={{ display: 'grid', gap: '12px', alignContent: 'start' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
              {details.vehicle} — {details.incidentType}
            </p>
            <h1 style={{ margin: '4px 0 8px', fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 }}>{details.claimId}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span className="pill" style={{ background: '#f1f5f9', color: '#475569' }}>{draftStatus}</span>
              {isViewOnly && <span className="pill" style={{ background: '#dcfce7', color: '#166534' }}>Completed — View Only</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!readonly && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="button-secondary" type="button" onClick={handleSaveDraft} disabled={saving || isViewOnly}>
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
              </div>
            )}
            <button className="button-secondary" type="button" onClick={handleExportPdf}>Export PDF</button>
            {!readonly && !isViewOnly && (
              <button type="button" onClick={handleFinishClaim} disabled={saving} style={{ background: '#16a34a', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 600, padding: '9px 18px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Finishing…' : 'Finish Claim'}
              </button>
            )}
            {!readonly && (confirmDelete ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => onDeleteReport(currentReport.id)}
                  style={{ background: '#dc2626', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, padding: '8px 14px', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 10, color: '#64748b', fontWeight: 600, padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                title="Delete claim"
                style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff1f2', border: '1px solid #fecdd3', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                🗑
              </button>
            ))}
            <button type="button" onClick={onBack} style={{ width: 34, height: 34, borderRadius: '50%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
          </div>
        </header>

        {readonly && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: '0.83rem', color: '#1e40af', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span>You are viewing this claim in demo mode. Export is available — sign in to make changes.</span>
          </div>
        )}
        {!readonly && isViewOnly && (
          <div className="view-only-banner">
            <span>&#10003;</span>
            This claim has been completed and is locked for viewing only. Export the packet to download a copy.
          </div>
        )}

        {renderSectionContent()}
      </section>

      {/* ── Resolve Modal ─────────────────────────────────────────────────── */}
      {resolveModal && resolveConfig && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setResolveModal(null); }}
        >
          <div style={{ background: '#fff', borderRadius: 18, padding: '24px 26px', maxWidth: '500px', width: '92%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Resolve: {resolveModal.item}</h2>
              <button onClick={() => setResolveModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            {resolveConfig.hint && (
              <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.83rem' }}>{resolveConfig.hint}</p>
            )}
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.87rem', marginBottom: 6 }}>{resolveConfig.label}</label>

            {resolveConfig.type === 'textarea' ? (
              <div>
                <textarea
                  value={resolveModal.value}
                  onChange={(e) => setResolveModal((prev) => prev ? { ...prev, value: e.target.value } : null)}
                  placeholder={resolveConfig.placeholder}
                  rows={5}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.87rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box' }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleRewriteDescription}
                  disabled={rewriteLoading || !resolveModal.value.trim()}
                  style={{ marginTop: 8, background: '#7c3aed', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, padding: '6px 14px', cursor: rewriteLoading || !resolveModal.value.trim() ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: !resolveModal.value.trim() ? 0.4 : 1 }}
                >
                  {rewriteLoading ? 'Rewriting…' : 'Rewrite with AI'}
                </button>
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#7c3aed' }}>Makes language neutral and insurance-ready</span>
              </div>
            ) : resolveConfig.type === 'select' ? (
              <select
                value={resolveModal.value}
                onChange={(e) => setResolveModal((prev) => prev ? { ...prev, value: e.target.value } : null)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.87rem', fontFamily: 'inherit', background: '#fff', outline: 'none' }}
                autoFocus
              >
                <option value="">— Select —</option>
                {resolveConfig.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={resolveModal.value}
                onChange={(e) => setResolveModal((prev) => prev ? { ...prev, value: e.target.value } : null)}
                placeholder={resolveConfig.placeholder}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none' }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') submitResolveModal(); }}
              />
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: 18, justifyContent: 'flex-end' }}>
              <button className="button-secondary" type="button" onClick={() => setResolveModal(null)}>Cancel</button>
              <button className="button-primary" type="button" onClick={submitResolveModal} disabled={!resolveModal.value.trim()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary Modal ─────────────────────────────────────────────────── */}
      {showSummaryModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSummaryModal(false); }}
        >
          <div style={{ background: '#fff', borderRadius: 18, padding: '22px 24px', maxWidth: '580px', maxHeight: '82vh', overflowY: 'auto', width: '92%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, position: 'sticky', top: 0, background: '#fff', paddingBottom: 10, borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Full Incident Summary</h2>
              <button onClick={() => setShowSummaryModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: '12px', color: '#334155', fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><strong>Claim ID</strong><div style={{ color: '#64748b', marginTop: 2 }}>{details.claimId}</div></div>
                <div><strong>Date</strong><div style={{ color: '#64748b', marginTop: 2 }}>{details.date}</div></div>
                <div><strong>Location</strong><div style={{ color: '#64748b', marginTop: 2 }}>{details.location || '—'}</div></div>
                <div><strong>Incident Type</strong><div style={{ color: '#64748b', marginTop: 2 }}>{details.incidentType || '—'}</div></div>
                <div><strong>Vehicle</strong><div style={{ color: '#64748b', marginTop: 2 }}>{details.vehicle || '—'}</div></div>
                <div><strong>Platform</strong><div style={{ color: '#64748b', marginTop: 2 }}>{details.platform || '—'}</div></div>
              </div>
              <div>
                <strong>Description</strong>
                <div style={{ color: '#64748b', marginTop: 2, lineHeight: 1.6 }}>{currentReport.description || 'No description provided.'}</div>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <strong>Evidence</strong>
                <div style={{ display: 'grid', gap: '5px', marginTop: 8 }}>
                  {evidenceStatus.map((e) => (
                    <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span>{e.label}</span>
                      <span style={{ color: e.status === 'Complete' ? '#16a34a' : e.status === 'Partial' ? '#d97706' : '#dc2626', fontWeight: 600 }}>{e.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              {Object.keys(interviewAnswers).length > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                  <strong>Interview Answers</strong>
                  <div style={{ display: 'grid', gap: '6px', marginTop: 8 }}>
                    {interviewQuestions.filter((q) => interviewAnswers[q.id]).map((q) => (
                      <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', gap: '10px' }}>
                        <span style={{ color: '#64748b', flex: 1 }}>{q.question}</span>
                        <span style={{ fontWeight: 600 }}>{interviewAnswers[q.id]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <strong>Readiness</strong>
                <div style={{ marginTop: 8 }}>
                  <ReadinessBar score={readiness.readinessScore} />
                  {readiness.missingItems.length > 0 && (
                    <div style={{ marginTop: 6, color: '#b91c1c', fontSize: '0.8rem' }}>Missing: {readiness.missingItems.join(', ')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
