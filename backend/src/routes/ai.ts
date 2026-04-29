import express from 'express';
import {
  AI_CONFIG,
  rewriteDescription,
  extractIncidentFields,
  generateInterviewQuestions,
  analyzeVehiclePhoto,
  generateClaimNarrative,
  detectInconsistencies,
} from '../services/aiProvider.js';

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json({ configured: AI_CONFIG.configured, provider: AI_CONFIG.provider });
});

router.post('/rewrite', async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
  const result = await rewriteDescription(text);
  res.json(result);
});

router.post('/extract', async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
  const result = await extractIncidentFields(text);
  res.json(result);
});

router.post('/questions', async (req, res) => {
  const { context } = req.body as { context?: string };
  if (!context?.trim()) return res.status(400).json({ error: 'context is required' });
  const result = await generateInterviewQuestions(context);
  res.json(result);
});

router.post('/analyze-photo', async (req, res) => {
  const { dataUrl, evidenceLabel } = req.body as { dataUrl?: string; evidenceLabel?: string };
  if (!dataUrl?.trim()) return res.status(400).json({ error: 'dataUrl is required' });

  const approxBytes = (dataUrl.length * 3) / 4;
  if (approxBytes > 8 * 1024 * 1024) {
    return res.json({
      result: { analysis: 'Image too large for AI analysis.', severity: 'Unknown', confidence: 0, notes: 'Please upload a smaller image (under 8 MB).' },
      aiUsed: false,
      error: 'Image exceeds 8 MB limit.',
    });
  }

  const result = await analyzeVehiclePhoto(dataUrl, evidenceLabel ?? 'Evidence');
  res.json(result);
});

router.post('/narrative', async (req, res) => {
  const { context } = req.body as { context?: string };
  if (!context?.trim()) return res.status(400).json({ error: 'context is required' });
  const result = await generateClaimNarrative(context);
  res.json(result);
});

router.post('/check-inconsistencies', async (req, res) => {
  const { description, interviewAnswers } = req.body as {
    description?: string;
    interviewAnswers?: Record<string, string>;
  };
  if (!description?.trim()) return res.status(400).json({ error: 'description is required' });
  const result = await detectInconsistencies(description, interviewAnswers ?? {});
  res.json(result);
});

export { router as aiRouter };
