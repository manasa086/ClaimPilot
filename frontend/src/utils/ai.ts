const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface AiResult<T> {
  result: T;
  aiUsed: boolean;
  error?: string;
}

async function post<T>(endpoint: string, body: object, fallback: T): Promise<AiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { result: fallback, aiUsed: false, error: (err as any).error ?? `Server error ${res.status}` };
    }
    return await res.json();
  } catch (err: any) {
    const msg = err?.message?.includes('fetch') ? 'Cannot reach backend server.' : (err?.message ?? 'Network error');
    return { result: fallback, aiUsed: false, error: msg };
  }
}

export interface ExtractedFields {
  title: string;
  location: string;
  incidentType: string;
  vehicle: string;
  platformStatus: string;
}

export interface AiQuestion {
  id: string;
  question: string;
  impact: 'High' | 'Medium' | 'Low';
  type?: 'yesno' | 'text';
}

export interface PhotoAnalysis {
  analysis: string;
  severity: 'None' | 'Minor' | 'Moderate' | 'Severe' | 'Unknown';
  confidence: number;
  notes: string;
}

export interface Inconsistency {
  field: string;
  issue: string;
  severity: 'High' | 'Medium' | 'Low';
}

export const aiApi = {
  rewrite: (text: string) =>
    post<string>('rewrite', { text }, text),

  extract: (text: string) =>
    post<ExtractedFields>('extract', { text }, { title: '', location: '', incidentType: '', vehicle: '', platformStatus: '' }),

  questions: (context: string) =>
    post<AiQuestion[]>('questions', { context }, []),

  analyzePhoto: (dataUrl: string, evidenceLabel: string) =>
    post<PhotoAnalysis>('analyze-photo', { dataUrl, evidenceLabel }, {
      analysis: 'Photo received. Manual review required.',
      severity: 'Unknown',
      confidence: 0,
      notes: 'AI analysis unavailable.',
    }),

  narrative: (context: string) =>
    post<string>('narrative', { context }, 'Narrative generation unavailable. Please add your OpenAI API key.'),

  checkInconsistencies: (description: string, interviewAnswers: Record<string, string>) =>
    post<Inconsistency[]>('check-inconsistencies', { description, interviewAnswers }, []),
};
