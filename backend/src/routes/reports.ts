import express from 'express';
import { pool } from '../db.js';
import type { IncidentReport } from '../types/api.js';
import { analyzeReportReadiness } from '../services/readinessAnalyzer.js';

const router = express.Router();

const sampleReports: IncidentReport[] = [
  {
    id: 'report-1',
    title: 'Toyota Camry collision',
    status: 'Needs Review',
    createdAt: '2026-04-24T10:12:00.000Z',
    updatedAt: '2026-04-24T10:12:00.000Z',
    vehicle: 'Toyota Camry',
    platformStatus: 'Uber trip active',
    location: 'Main St & 5th Ave, Cityville, CA',
    incidentType: 'Rear-end collision',
    readinessScore: 55,
    missingItems: ['Incident description'],
  },
];

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
  };
}

router.get('/', async (_req, res) => {
  if (!pool) return res.json({ data: sampleReports });

  const result = await pool.query(
    `SELECT id, title, status, created_at, updated_at, vehicle, platform_status,
            incident_type, location, description, readiness_score, missing_items, photo_urls
     FROM incident_reports ORDER BY updated_at DESC`,
  );
  res.json({ data: result.rows.map(rowToReport) });
});

router.post('/', async (req, res) => {
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

  if (pool) {
    await pool.query(
      `INSERT INTO incident_reports
         (id, user_id, title, status, vehicle, platform_status, incident_type,
          location, description, readiness_score, missing_items, photo_urls, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())`,
      [
        newReport.id, 'local-user', newReport.title, newReport.status,
        newReport.vehicle ?? null, newReport.platformStatus ?? null,
        newReport.incidentType ?? null, newReport.location ?? null,
        newReport.description ?? null, newReport.readinessScore,
        newReport.missingItems, JSON.stringify(newReport.photoUrls),
      ],
    );
  }

  res.status(201).json({ data: newReport });
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body as Partial<IncidentReport>;

  // When DB is available, fetch current record for a proper merge
  let existing: IncidentReport | undefined = sampleReports.find((r) => r.id === id);

  if (pool) {
    const result = await pool.query(
      `SELECT id, title, status, created_at, updated_at, vehicle, platform_status,
              incident_type, location, description, readiness_score, missing_items, photo_urls
       FROM incident_reports WHERE id = $1`,
      [id],
    );
    if (result.rows.length > 0) existing = rowToReport(result.rows[0]);
  }

  if (!existing) return res.status(404).json({ error: 'Report not found.' });

  const updatedReport: IncidentReport = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const readiness = analyzeReportReadiness(updatedReport);
  updatedReport.readinessScore = readiness.readinessScore;
  updatedReport.missingItems = readiness.missingItems;

  if (pool) {
    await pool.query(
      `UPDATE incident_reports
       SET title=$1, status=$2, vehicle=$3, platform_status=$4, incident_type=$5,
           location=$6, description=$7, readiness_score=$8, missing_items=$9,
           photo_urls=$10, updated_at=NOW()
       WHERE id=$11`,
      [
        updatedReport.title, updatedReport.status,
        updatedReport.vehicle ?? null, updatedReport.platformStatus ?? null,
        updatedReport.incidentType ?? null, updatedReport.location ?? null,
        updatedReport.description ?? null, updatedReport.readinessScore,
        updatedReport.missingItems, JSON.stringify(updatedReport.photoUrls ?? []),
        id,
      ],
    );
  } else {
    const idx = sampleReports.findIndex((r) => r.id === id);
    if (idx !== -1) sampleReports[idx] = updatedReport;
  }

  res.json({ data: updatedReport });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const idx = sampleReports.findIndex((r) => r.id === id);

  if (idx === -1 && !pool) return res.status(404).json({ error: 'Report not found.' });
  if (idx !== -1) sampleReports.splice(idx, 1);
  if (pool) await pool.query('DELETE FROM incident_reports WHERE id = $1', [id]);

  res.json({ success: true });
});

export { router as reportsRouter };
