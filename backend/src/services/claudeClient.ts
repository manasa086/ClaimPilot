import Anthropic from '@anthropic-ai/sdk';

// ── Configuration ─────────────────────────────────────────────────────────────

const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
const isConfigured = apiKey.length > 0 && apiKey !== 'your-anthropic-api-key';
const client = isConfigured ? new Anthropic({ apiKey }) : null;

export const AI_STATUS = { configured: isConfigured };

const TEXT_MODEL = 'claude-haiku-4-5';
const VISION_MODEL = 'claude-sonnet-4-6';

// ── Failsafe wrapper ──────────────────────────────────────────────────────────

function classifyError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return 'Rate limit exceeded — please try again in a moment.';
  if (err instanceof Anthropic.AuthenticationError) return 'Invalid Anthropic API key — check your .env file.';
  if (err instanceof Anthropic.APIError) {
    if (err.status === 503 || err.status === 500) return 'Anthropic service temporarily unavailable.';
    return `AI error: ${err.message}`;
  }
  const e = err as any;
  if (e?.code === 'ENOTFOUND' || e?.code === 'ECONNREFUSED') return 'Network error reaching AI service.';
  if (e?.code === 'ETIMEDOUT' || e?.name === 'AbortError') return 'AI request timed out.';
  return `AI error: ${e?.message ?? 'Unknown error'}`;
}

async function safeCall<T>(
  fn: (c: Anthropic) => Promise<T>,
  fallback: T,
): Promise<{ result: T; aiUsed: boolean; error?: string }> {
  if (!client) {
    return { result: fallback, aiUsed: false, error: 'AI not configured. Add ANTHROPIC_API_KEY to .env to enable.' };
  }
  try {
    const result = await fn(client);
    return { result, aiUsed: true };
  } catch (err) {
    const error = classifyError(err);
    console.warn('[Claude] Falling back to default:', error);
    return { result: fallback, aiUsed: false, error };
  }
}

// Claude returns text — strip markdown code fences and parse JSON
function parseJson<T>(text: string, fallback: T): T {
  try {
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return JSON.parse(stripped);
  } catch {
    return fallback;
  }
}

function extractText(msg: Anthropic.Message): string {
  const block = msg.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}

// ── 1. Rewrite description in neutral, insurance-ready language ───────────────

export function rewriteDescription(text: string) {
  return safeCall(async (c) => {
    const msg = await c.messages.create({
      model: TEXT_MODEL,
      max_tokens: 400,
      system: [
        {
          type: 'text',
          text: 'You are a professional claims adjuster. Rewrite incident descriptions in neutral, factual, insurance-ready language. Use third person, remove emotion and blame, keep all facts, stay under 200 words.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: text }],
    });
    return extractText(msg) || text;
  }, text);
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
  return safeCall(async (c) => {
    const msg = await c.messages.create({
      model: TEXT_MODEL,
      max_tokens: 300,
      system: [
        {
          type: 'text',
          text: `Extract incident details from user text. Return ONLY valid JSON with these fields (use empty string if not found):
- title: short descriptive claim title (10 words max)
- location: street address or intersection
- incidentType: one of [${INCIDENT_TYPES.join(', ')}]
- vehicle: year make model if mentioned
- platformStatus: rideshare/delivery status (e.g. "Uber trip active") or empty string`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: text }],
    });
    const parsed = parseJson<Partial<ExtractedFields>>(extractText(msg), {});
    return { ...fallback, ...parsed } as ExtractedFields;
  }, fallback);
}

// ── 3. Generate contextual interview questions ────────────────────────────────

export interface AiQuestion {
  id: string;
  question: string;
  impact: 'High' | 'Medium' | 'Low';
  type: 'yesno' | 'text';
}

const fallbackQuestions: AiQuestion[] = [
  { id: 'ai_1', question: 'Were there any traffic signals or signs relevant to the incident?', impact: 'Medium', type: 'yesno' },
  { id: 'ai_2', question: 'Did you exchange contact information with the other driver?', impact: 'High', type: 'yesno' },
  { id: 'ai_3', question: 'Was the vehicle driveable after the incident?', impact: 'Low', type: 'yesno' },
  { id: 'ai_4', question: 'Describe any road or weather conditions that may have contributed to the incident.', impact: 'Medium', type: 'text' },
];

export function generateInterviewQuestions(reportContext: string) {
  return safeCall(async (c) => {
    const msg = await c.messages.create({
      model: TEXT_MODEL,
      max_tokens: 600,
      system: [
        {
          type: 'text',
          text: 'You are a claims investigator. Generate 4 specific follow-up interview questions for this incident that would strengthen an insurance claim. For each question, set "type" to "yesno" if it can be answered with yes or no, or "text" if it requires a descriptive answer. Return ONLY valid JSON: {"questions": [{"id": "ai_1", "question": "...", "impact": "High|Medium|Low", "type": "yesno|text"}]}',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: `Incident context:\n${reportContext}` }],
    });
    const parsed = parseJson<{ questions?: AiQuestion[] }>(extractText(msg), {});
    return (parsed.questions ?? fallbackQuestions).map((q, i) => ({
      ...q,
      id: q.id || `ai_${i + 1}`,
      type: q.type === 'text' ? 'text' : 'yesno',
    })) as AiQuestion[];
  }, fallbackQuestions);
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
  return safeCall(async (c) => {
    // Strip data URL prefix and extract media_type for Anthropic vision API
    const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/s);
    const mediaType = (match?.[1] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    const base64Data = match?.[2] ?? dataUrl;

    const msg = await c.messages.create({
      model: VISION_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: `This image was uploaded as "${evidenceLabel}" evidence for a vehicle insurance claim. Analyze it and return ONLY valid JSON: {"analysis": "brief factual description", "severity": "None|Minor|Moderate|Severe|Unknown", "confidence": 0-100, "notes": "important observations for the claim"}`,
            },
          ],
        },
      ],
    });
    const parsed = parseJson<Partial<PhotoAnalysis>>(extractText(msg), {});
    return { ...fallbackPhotoAnalysis, ...parsed } as PhotoAnalysis;
  }, fallbackPhotoAnalysis);
}

// ── 5. Generate professional claim narrative for export ───────────────────────

const narrativeFallback = (context: string) =>
  `This incident report has been prepared based on information provided by the claimant. The details recorded include the incident circumstances, supporting evidence, and responses to key interview questions. Please review all sections for completeness and accuracy before submission to the insurance provider.\n\nContext summary: ${context.slice(0, 300)}...`;

export function generateClaimNarrative(context: string) {
  return safeCall(async (c) => {
    const msg = await c.messages.create({
      model: TEXT_MODEL,
      max_tokens: 600,
      system: [
        {
          type: 'text',
          text: 'You are a professional claims adjuster writing formal incident narratives for insurance submissions. Write in third person, neutral, factual language. 2-3 paragraphs. Do not include readiness scores, app metrics, or system-generated data.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: `Write a professional claim narrative based on:\n${context}` }],
    });
    return extractText(msg) || narrativeFallback(context);
  }, narrativeFallback(context));
}

// ── 6. Detect inconsistencies between description and interview ───────────────

export interface Inconsistency {
  field: string;
  issue: string;
  severity: 'High' | 'Medium' | 'Low';
}

export function detectInconsistencies(description: string, interviewAnswers: Record<string, string>) {
  const fallback: Inconsistency[] = [];
  return safeCall(async (c) => {
    const answers = Object.entries(interviewAnswers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    const msg = await c.messages.create({
      model: TEXT_MODEL,
      max_tokens: 500,
      system: [
        {
          type: 'text',
          text: 'You are a claims auditor. Find factual inconsistencies between an incident description and interview answers. Return ONLY valid JSON: {"inconsistencies": [{"field": "which field", "issue": "what conflicts", "severity": "High|Medium|Low"}]}. Return {"inconsistencies": []} if none found.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: `Description:\n${description}\n\nInterview answers:\n${answers}` }],
    });
    const parsed = parseJson<{ inconsistencies?: Inconsistency[] }>(extractText(msg), {});
    return parsed.inconsistencies ?? fallback;
  }, fallback);
}
