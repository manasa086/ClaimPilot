import OpenAI from 'openai';

// ── Configuration ─────────────────────────────────────────────────────────────

const apiKey = process.env.OPENAI_API_KEY ?? '';
const isConfigured = apiKey.length > 0 && apiKey !== 'your-openai-api-key';
const client = isConfigured ? new OpenAI({ apiKey }) : null;

export const AI_STATUS = { configured: isConfigured };

const TEXT_MODEL = 'gpt-4o-mini';
const VISION_MODEL = 'gpt-4o';

// ── Failsafe wrapper ──────────────────────────────────────────────────────────

function classifyError(err: unknown): string {
  const e = err as any;
  if (e?.status === 429) return 'Rate limit exceeded — please try again in a moment.';
  if (e?.status === 401) return 'Invalid OpenAI API key — check your .env file.';
  if (e?.status === 503 || e?.status === 500) return 'OpenAI service temporarily unavailable.';
  if (e?.code === 'ENOTFOUND' || e?.code === 'ECONNREFUSED') return 'Network error reaching AI service.';
  if (e?.code === 'ETIMEDOUT' || e?.name === 'AbortError') return 'AI request timed out.';
  if (e?.error?.message) return `AI error: ${e.error.message}`;
  return `AI error: ${e?.message ?? 'Unknown error'}`;
}

async function safeCall<T>(
  fn: (client: OpenAI) => Promise<T>,
  fallback: T,
): Promise<{ result: T; aiUsed: boolean; error?: string }> {
  if (!client) {
    return { result: fallback, aiUsed: false, error: 'AI not configured. Add OPENAI_API_KEY to .env to enable.' };
  }
  try {
    const result = await fn(client);
    return { result, aiUsed: true };
  } catch (err) {
    const error = classifyError(err);
    console.warn('[AI] Falling back to default:', error);
    return { result: fallback, aiUsed: false, error };
  }
}

// ── 1. Rewrite description in neutral, insurance-ready language ───────────────

export function rewriteDescription(text: string) {
  return safeCall(
    async (c) => {
      const res = await c.chat.completions.create({
        model: TEXT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a professional claims adjuster. Rewrite incident descriptions in neutral, factual, insurance-ready language. Use third person, remove emotion and blame, keep all facts, stay under 200 words.',
          },
          { role: 'user', content: text },
        ],
      });
      return res.choices[0].message.content ?? text;
    },
    text,
  );
}

// ── 2. Extract structured fields from free-text description ──────────────────

interface ExtractedFields {
  location: string;
  incidentType: string;
  vehicle: string;
  platformStatus: string;
  title: string;
}

const INCIDENT_TYPES = [
  'Rear-end collision', 'Side-impact (T-bone)', 'Head-on collision',
  'Hit and run', 'Sideswipe', 'Parking lot incident', 'Rollover', 'Other',
];

export function extractIncidentFields(text: string) {
  const fallback: ExtractedFields = { location: '', incidentType: '', vehicle: '', platformStatus: '', title: '' };
  return safeCall(
    async (c) => {
      const res = await c.chat.completions.create({
        model: TEXT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Extract incident details from user text. Return JSON with these fields (use empty string if not found):
- title: short descriptive claim title (10 words max)
- location: street address or intersection
- incidentType: one of [${INCIDENT_TYPES.join(', ')}]
- vehicle: year make model if mentioned
- platformStatus: rideshare/delivery status (e.g. "Uber trip active") or empty string`,
          },
          { role: 'user', content: text },
        ],
      });
      const parsed = JSON.parse(res.choices[0].message.content ?? '{}');
      return { ...fallback, ...parsed } as ExtractedFields;
    },
    fallback,
  );
}

// ── 3. Generate contextual interview questions ────────────────────────────────

export interface AiQuestion {
  id: string;
  question: string;
  impact: 'High' | 'Medium' | 'Low';
}

const fallbackQuestions: AiQuestion[] = [
  { id: 'ai_1', question: 'Were there any traffic signals or signs relevant to the incident?', impact: 'Medium' },
  { id: 'ai_2', question: 'Did you exchange contact information with the other driver?', impact: 'High' },
  { id: 'ai_3', question: 'Was the vehicle driveable after the incident?', impact: 'Low' },
  { id: 'ai_4', question: 'Were there any road or weather conditions that contributed?', impact: 'Medium' },
];

export function generateInterviewQuestions(reportContext: string) {
  return safeCall(
    async (c) => {
      const res = await c.chat.completions.create({
        model: TEXT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a claims investigator. Generate 4 specific follow-up interview questions for this incident that would strengthen an insurance claim. Return JSON: {"questions": [{"id": "ai_1", "question": "...", "impact": "High|Medium|Low"}]}',
          },
          { role: 'user', content: `Incident context:\n${reportContext}` },
        ],
      });
      const parsed = JSON.parse(res.choices[0].message.content ?? '{}');
      return (parsed.questions as AiQuestion[]) ?? fallbackQuestions;
    },
    fallbackQuestions,
  );
}

// ── 4. Analyze a vehicle photo (vision) ──────────────────────────────────────

export interface PhotoAnalysis {
  analysis: string;
  severity: 'None' | 'Minor' | 'Moderate' | 'Severe' | 'Unknown';
  confidence: number;
  notes: string;
}

const fallbackPhotoAnalysis: PhotoAnalysis = {
  analysis: 'Photo received. Manual review required.',
  severity: 'Unknown',
  confidence: 0,
  notes: 'AI analysis unavailable — photo will be reviewed manually.',
};

export function analyzeVehiclePhoto(dataUrl: string, evidenceLabel: string) {
  return safeCall(
    async (c) => {
      const res = await c.chat.completions.create({
        model: VISION_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `This image was uploaded as "${evidenceLabel}" evidence for a vehicle insurance claim. Analyze it and return JSON: {"analysis": "brief factual description", "severity": "None|Minor|Moderate|Severe|Unknown", "confidence": 0-100, "notes": "important observations for the claim"}`,
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: 'low' },
              },
            ],
          },
        ],
      });
      const parsed = JSON.parse(res.choices[0].message.content ?? '{}');
      return { ...fallbackPhotoAnalysis, ...parsed } as PhotoAnalysis;
    },
    fallbackPhotoAnalysis,
  );
}

// ── 5. Generate professional claim narrative for export ───────────────────────

const narrativeFallback = (context: string) =>
  `This incident report has been prepared based on information provided by the claimant. The details recorded include the incident circumstances, supporting evidence, and responses to key interview questions. Please review all sections for completeness and accuracy before submission to the insurance provider.\n\nContext summary: ${context.slice(0, 300)}...`;

export function generateClaimNarrative(context: string) {
  return safeCall(
    async (c) => {
      const res = await c.chat.completions.create({
        model: TEXT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a professional claims adjuster writing formal incident narratives for insurance submissions. Write in third person, neutral, factual language. 2-3 paragraphs. Do not include readiness scores, app metrics, or system-generated data.',
          },
          { role: 'user', content: `Write a professional claim narrative based on:\n${context}` },
        ],
      });
      return res.choices[0].message.content ?? narrativeFallback(context);
    },
    narrativeFallback(context),
  );
}

// ── 6. Detect inconsistencies between description and interview ───────────────

export interface Inconsistency {
  field: string;
  issue: string;
  severity: 'High' | 'Medium' | 'Low';
}

export function detectInconsistencies(description: string, interviewAnswers: Record<string, string>) {
  const fallback: Inconsistency[] = [];
  return safeCall(
    async (c) => {
      const answers = Object.entries(interviewAnswers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      const res = await c.chat.completions.create({
        model: TEXT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a claims auditor. Find factual inconsistencies between an incident description and interview answers. Return JSON: {"inconsistencies": [{"field": "which field", "issue": "what conflicts", "severity": "High|Medium|Low"}]}. Return empty array if none found.',
          },
          { role: 'user', content: `Description:\n${description}\n\nInterview answers:\n${answers}` },
        ],
      });
      const parsed = JSON.parse(res.choices[0].message.content ?? '{}');
      return (parsed.inconsistencies as Inconsistency[]) ?? fallback;
    },
    fallback,
  );
}
