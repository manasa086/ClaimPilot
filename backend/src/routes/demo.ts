import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

function rowToReport(row: any) {
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

// Public read-only access to the dummy/demo table.
// No write endpoints are exposed here — the table is managed manually.

router.get('/', async (_req, res) => {
  if (!pool) return res.json({ data: [] });
  try {
    const result = await pool.query(
      `SELECT id, title, status, created_at, updated_at, vehicle, platform_status,
              incident_type, location, description, readiness_score, missing_items, photo_urls
       FROM incident_reports_dummy ORDER BY updated_at DESC`,
    );
    res.json({ data: result.rows.map(rowToReport) });
  } catch {
    res.json({ data: [] });
  }
});

router.get('/:id', async (req, res) => {
  if (!pool) return res.status(404).json({ error: 'Not found' });
  try {
    const result = await pool.query(
      `SELECT id, title, status, created_at, updated_at, vehicle, platform_status,
              incident_type, location, description, readiness_score, missing_items, photo_urls
       FROM incident_reports_dummy WHERE id = $1`,
      [req.params.id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: rowToReport(result.rows[0]) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export { router as demoRouter };
