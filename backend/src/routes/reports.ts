import express from 'express';
import { pool } from '../db.js';
import type { IncidentReport } from '../types/api.js';
import { analyzeReportReadiness } from '../services/readinessAnalyzer.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { AuthRequest } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

function rowToReport(row: any): IncidentReport {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at?.toISOString() ?? '',
    updatedAt: row.updated_at?.toISOString() ?? '',
    vehicle: row.vehicle ?? '',
    platformStatus: row.platform_status ?? '',
    incidentType: row.incident_type ?? '',
    location: row.location ?? '',
    description: row.description ?? '',
    readinessScore: row.readiness_score ?? 0,
    missingItems: row.missing_items ?? [],
    photoUrls: row.photo_urls ?? [],
    interviewAnswers: row.interview_answers ?? {},
    aiQuestions: row.ai_questions ?? [],
  };
}

router.get('/', async (req: AuthRequest, res) => {
  const result = await pool!.query(
    `SELECT id, title, status, created_at, updated_at, vehicle, platform_status,
            incident_type, location, description, readiness_score, missing_items,
            photo_urls, interview_answers, ai_questions
     FROM incident_reports WHERE user_id = $1 ORDER BY updated_at DESC`,
    [req.userName],
  );
  res.json({ data: result.rows.map(rowToReport) });
});

router.post('/', async (req: AuthRequest, res) => {
  const report = req.body as IncidentReport;
  if (!report?.id || !report?.title) {
    return res.status(400).json({ error: 'Report id and title are required.' });
  }

  const readiness = analyzeReportReadiness(report);
  const newReport: IncidentReport = {
    ...report,
    status: report.status || 'Draft',
    readinessScore: readiness.readinessScore,
    missingItems: readiness.missingItems,
    photoUrls: report.photoUrls ?? [],
    updatedAt: new Date().toISOString(),
  };

  await pool!.query(
    `INSERT INTO incident_reports
       (id, user_id, title, status, vehicle, platform_status, incident_type,
        location, description, readiness_score, missing_items, photo_urls,
        interview_answers, ai_questions, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())`,
    [
      newReport.id, req.userName, newReport.title, newReport.status,
      newReport.vehicle ?? null, newReport.platformStatus ?? null,
      newReport.incidentType ?? null, newReport.location ?? null,
      newReport.description ?? null, newReport.readinessScore,
      newReport.missingItems, JSON.stringify(newReport.photoUrls ?? []),
      JSON.stringify(newReport.interviewAnswers ?? {}),
      JSON.stringify(newReport.aiQuestions ?? []),
    ],
  );

  res.status(201).json({ data: newReport });
});

router.patch('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const updates = req.body as Partial<IncidentReport>;

  const result = await pool!.query(
    `SELECT id, title, status, created_at, updated_at, vehicle, platform_status,
            incident_type, location, description, readiness_score, missing_items,
            photo_urls, interview_answers, ai_questions
     FROM incident_reports WHERE id = $1 AND user_id = $2`,
    [id, req.userName],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found.' });

  const existing = rowToReport(result.rows[0]);
  const updatedReport: IncidentReport = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const readiness = analyzeReportReadiness(updatedReport);
  updatedReport.readinessScore = readiness.readinessScore;
  updatedReport.missingItems = readiness.missingItems;

  await pool!.query(
    `UPDATE incident_reports
     SET title=$1, status=$2, vehicle=$3, platform_status=$4, incident_type=$5,
         location=$6, description=$7, readiness_score=$8, missing_items=$9,
         photo_urls=$10, interview_answers=$11, ai_questions=$12, updated_at=NOW()
     WHERE id=$13 AND user_id=$14`,
    [
      updatedReport.title, updatedReport.status,
      updatedReport.vehicle ?? null, updatedReport.platformStatus ?? null,
      updatedReport.incidentType ?? null, updatedReport.location ?? null,
      updatedReport.description ?? null, updatedReport.readinessScore,
      updatedReport.missingItems, JSON.stringify(updatedReport.photoUrls ?? []),
      JSON.stringify(updatedReport.interviewAnswers ?? {}),
      JSON.stringify(updatedReport.aiQuestions ?? []),
      id, req.userName,
    ],
  );

  res.json({ data: updatedReport });
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await pool!.query(
    'DELETE FROM incident_reports WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userName],
  );
  res.json({ success: true });
});

export { router as reportsRouter };
