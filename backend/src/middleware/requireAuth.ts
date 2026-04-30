import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db.js';

export interface AuthRequest extends Request {
  userName?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const sessionId = req.headers['x-session-id'] as string | undefined;
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated.' });
  if (!pool) return res.status(503).json({ error: 'Database unavailable.' });

  try {
    const result = await pool.query(
      'SELECT user_name FROM sessions WHERE id = $1 AND expires_at > NOW()',
      [sessionId],
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    req.userName = result.rows[0].user_name as string;
    next();
  } catch {
    res.status(500).json({ error: 'Authentication check failed.' });
  }
}
