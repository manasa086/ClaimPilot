import { useState } from 'react';
import type { IncidentReport } from '../types/incident';
import { aiApi } from '../utils/ai';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface NewReportFormProps {
  onReportCreated: (report: IncidentReport) => void;
  onCancel: () => void;
}

function AiBadge({ aiUsed }: { aiUsed: boolean }) {
  if (!aiUsed) return null;
  return (
    <span style={{ fontSize: '0.68rem', background: '#ede9fe', color: '#7c3aed', padding: '2px 7px', borderRadius: 9999, fontWeight: 700, marginLeft: 6 }}>
      AI filled
    </span>
  );
}

export default function NewReportForm({ onReportCreated, onCancel }: NewReportFormProps) {
  const [freeText, setFreeText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    title: '',
    vehicle: '',
    platformStatus: '',
    location: '',
    incidentType: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear AI badge when user manually edits a field
    setAiFilledFields((prev) => { const n = new Set(prev); n.delete(field); return n; });
  };

  const handleAiAutofill = async () => {
    if (!freeText.trim()) return;
    setAiLoading(true);
    setAiError(null);
    const res = await aiApi.extract(freeText);
    setAiLoading(false);

    if (res.error && !res.aiUsed) {
      setAiError(res.error);
    }

    const filled = new Set<string>();
    const updates: Partial<typeof formData> = {};

    if (res.result.title && !formData.title) { updates.title = res.result.title; filled.add('title'); }
    if (res.result.location && !formData.location) { updates.location = res.result.location; filled.add('location'); }
    if (res.result.incidentType && !formData.incidentType) { updates.incidentType = res.result.incidentType; filled.add('incidentType'); }
    if (res.result.vehicle && !formData.vehicle) { updates.vehicle = res.result.vehicle; filled.add('vehicle'); }
    if (res.result.platformStatus && !formData.platformStatus) { updates.platformStatus = res.result.platformStatus; filled.add('platformStatus'); }
    // Always copy free text as description
    if (!formData.description) { updates.description = freeText; filled.add('description'); }

    setFormData((prev) => ({ ...prev, ...updates }));
    setAiFilledFields(filled);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `CP-${Date.now()}`,
          ...formData,
          status: 'Draft',
          readinessScore: 0,
          missingItems: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
      if (response.ok) {
        const data = await response.json();
        onReportCreated(data.data);
      } else {
        alert('Failed to create report');
      }
    } catch {
      alert('Error creating report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: '24px', borderRadius: 20, maxWidth: '800px', margin: '0 auto' }}>
      <p style={{ margin: 0, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.75rem' }}>New Claim</p>
      <h2 style={{ margin: '6px 0 4px', fontSize: '1.35rem', lineHeight: 1.2 }}>Create a new incident report</h2>
      <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '0.85rem' }}>
        Describe the incident in your own words and let AI fill in the details, or fill the form manually.
      </p>

      {/* ── AI Autofill ── */}
      <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 14, padding: '16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>AI Autofill</span>
            <span style={{ marginLeft: 8, fontSize: '0.78rem', color: '#7c3aed', background: '#ede9fe', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>Powered by GPT-4o</span>
          </div>
          {aiLoading && <span style={{ fontSize: '0.8rem', color: '#7c3aed' }}>Extracting fields…</span>}
        </div>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Describe the incident in your own words. Example: 'I was driving a 2024 Toyota Camry on an Uber trip at Main St & 5th Ave when another car rear-ended me at around 4 PM. The other driver ran a red light.'"
          rows={4}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d8b4fe', fontSize: '0.87rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, background: '#fff', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          {aiError ? (
            <span style={{ fontSize: '0.78rem', color: '#dc2626', background: '#fee2e2', padding: '4px 10px', borderRadius: 8 }}>
              {aiError} — form fields still editable manually.
            </span>
          ) : aiFilledFields.size > 0 ? (
            <span style={{ fontSize: '0.78rem', color: '#16a34a' }}>
              AI filled {aiFilledFields.size} field{aiFilledFields.size > 1 ? 's' : ''}. Review and edit as needed.
            </span>
          ) : (
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>AI will extract: title, location, incident type, vehicle, platform status.</span>
          )}
          <button
            type="button"
            onClick={handleAiAutofill}
            disabled={!freeText.trim() || aiLoading}
            style={{ background: '#7c3aed', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, padding: '8px 16px', cursor: !freeText.trim() || aiLoading ? 'not-allowed' : 'pointer', fontSize: '0.83rem', opacity: !freeText.trim() || aiLoading ? 0.5 : 1, whiteSpace: 'nowrap' }}
          >
            {aiLoading ? 'Extracting…' : 'Autofill with AI'}
          </button>
        </div>
      </div>

      {/* ── Manual form ── */}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: '0.87rem' }}>
            Claim Title *<AiBadge aiUsed={aiFilledFields.has('title')} />
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g., 2026 Toyota Camry rear-end on Main St"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d8e0e8', fontSize: '0.87rem', marginTop: 5, boxSizing: 'border-box', outline: 'none' }}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.87rem' }}>
              Vehicle<AiBadge aiUsed={aiFilledFields.has('vehicle')} />
            </label>
            <input
              type="text"
              value={formData.vehicle}
              onChange={(e) => handleChange('vehicle', e.target.value)}
              placeholder="e.g., 2026 Toyota Camry"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d8e0e8', fontSize: '0.87rem', marginTop: 5, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.87rem' }}>
              Platform Status<AiBadge aiUsed={aiFilledFields.has('platformStatus')} />
            </label>
            <input
              type="text"
              value={formData.platformStatus}
              onChange={(e) => handleChange('platformStatus', e.target.value)}
              placeholder="e.g., Uber trip active"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d8e0e8', fontSize: '0.87rem', marginTop: 5, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.87rem' }}>
              Incident Location<AiBadge aiUsed={aiFilledFields.has('location')} />
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g., Main St & 5th Ave, Los Angeles, CA"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d8e0e8', fontSize: '0.87rem', marginTop: 5, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.87rem' }}>
              Incident Type<AiBadge aiUsed={aiFilledFields.has('incidentType')} />
            </label>
            <input
              type="text"
              value={formData.incidentType}
              onChange={(e) => handleChange('incidentType', e.target.value)}
              placeholder="e.g., Rear-end collision"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d8e0e8', fontSize: '0.87rem', marginTop: 5, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontWeight: 600, fontSize: '0.87rem' }}>
            Incident Description<AiBadge aiUsed={aiFilledFields.has('description')} />
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Detailed description of what happened…"
            rows={3}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d8e0e8', fontSize: '0.87rem', marginTop: 5, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: 4 }}>
          <button className="button-primary" type="submit" disabled={loading || !formData.title.trim()}>
            {loading ? 'Creating…' : 'Create and open dashboard'}
          </button>
          <button className="button-secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
