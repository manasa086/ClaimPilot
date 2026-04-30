import express from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { sendSignupRequestEmail } from '../services/emailService.js';

const router = express.Router();

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory session cache — also written to DB when available
const memorySessions = new Map<string, { userName: string; expiresAt: number }>();

async function verifyCredentials(username: string, password: string): Promise<string | null> {
  const lower = username.trim().toLowerCase();

  // DB auth: uses pgcrypto crypt() — works with both Supabase and local PostgreSQL
  if (pool) {
    try {
      const result = await pool.query(
        `SELECT username FROM users
         WHERE LOWER(username) = $1
           AND password_hash = crypt($2, password_hash)`,
        [lower, password],
      );
      if (result.rows.length > 0) return result.rows[0].username as string;
    } catch (err) {
      console.warn('[Auth] DB credential check failed, falling back to env vars:', (err as any)?.message);
    }
  }

  // Env-var fallback (used when users table is not yet created or DB unavailable)
  const AUTH_USERNAME = (process.env.AUTH_USERNAME ?? 'manasa').toLowerCase();
  const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? process.env.SUPABASE_PASSWORD ?? '';
  if (lower === AUTH_USERNAME && password === AUTH_PASSWORD) return AUTH_USERNAME;

  return null;
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const userName = await verifyCredentials(username, password);
  if (!userName) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  memorySessions.set(sessionId, { userName, expiresAt: expiresAt.getTime() });

  if (pool) {
    try {
      await pool.query(
        'INSERT INTO sessions (id, user_name, expires_at) VALUES ($1, $2, $3)',
        [sessionId, userName, expiresAt],
      );
    } catch (err) {
      console.warn('[Auth] Could not persist session:', (err as any)?.message);
    }
  }

  res.json({ sessionId, userName, expiresAt: expiresAt.toISOString() });
});

router.post('/verify', async (req, res) => {
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId) return res.json({ valid: false });

  const cached = memorySessions.get(sessionId);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ valid: true, userName: cached.userName });
  }

  if (pool) {
    try {
      const result = await pool.query(
        'SELECT user_name, expires_at FROM sessions WHERE id = $1',
        [sessionId],
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        if (new Date(row.expires_at) > new Date()) {
          memorySessions.set(sessionId, {
            userName: row.user_name,
            expiresAt: new Date(row.expires_at).getTime(),
          });
          return res.json({ valid: true, userName: row.user_name });
        }
      }
    } catch (err) {
      console.warn('[Auth] Could not verify session from DB:', (err as any)?.message);
    }
  }

  res.json({ valid: false });
});

router.post('/signup-request', async (req, res) => {
  const { username, password, reason } = req.body as {
    username?: string; password?: string; reason?: string;
  };

  if (!username?.trim() || !password?.trim() || !reason?.trim()) {
    return res.status(400).json({ error: 'Username, password, and reason are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  if (!pool) {
    return res.status(503).json({ error: 'Database unavailable.' });
  }

  try {
    const existing = await pool.query(
      'SELECT 1 FROM users WHERE LOWER(username) = $1',
      [username.trim().toLowerCase()],
    );
    if ((existing.rowCount ?? 0) > 0) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const duplicate = await pool.query(
      'SELECT 1 FROM signup_requests WHERE LOWER(username) = $1 AND status = $2',
      [username.trim().toLowerCase(), 'pending'],
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return res.status(409).json({ error: 'A request for that username is already pending.' });
    }

    const actionToken = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO signup_requests (username, password_hash, reason, action_token)
       VALUES ($1, crypt($2, gen_salt('bf')), $3, $4)
       RETURNING id`,
      [username.trim(), password, reason.trim(), actionToken],
    );
    const requestId = result.rows[0].id as string;

    // Send email — don't block the response if email fails
    sendSignupRequestEmail({ requestId, username: username.trim(), reason: reason.trim(), actionToken })
      .catch((err) => console.error('[Auth] Failed to send signup email:', err?.message));

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] signup-request error:', (err as any)?.message);
    res.status(500).json({ error: 'Failed to save request. Please try again.' });
  }
});

// Approve: add to users table, mark approved
router.get('/signup-request/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { token } = req.query as { token?: string };

  if (!token || !pool) return res.status(400).send(actionPage('Error', 'Invalid request.', '#dc2626'));

  try {
    const row = await pool.query(
      'SELECT username, password_hash, status, action_token FROM signup_requests WHERE id = $1',
      [id],
    );
    if (row.rows.length === 0) return res.send(actionPage('Not found', 'This request does not exist.', '#dc2626'));
    const req_ = row.rows[0];
    if (req_.action_token !== token) return res.status(403).send(actionPage('Unauthorized', 'Invalid approval token.', '#dc2626'));
    if (req_.status !== 'pending') {
      return res.send(actionPage(
        'Already processed',
        `This request has already been <strong>${req_.status}</strong>.`,
        '#64748b',
      ));
    }

    // Add to users table
    await pool.query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [req_.username, req_.password_hash],
    );

    await pool.query(
      `UPDATE signup_requests SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
      [id],
    );

    res.send(actionPage('Access approved', `<strong>${escapeHtml(req_.username)}</strong> has been added to the authorized users list and can now sign in.`, '#16a34a'));
  } catch (err) {
    console.error('[Auth] approve error:', (err as any)?.message);
    res.status(500).send(actionPage('Error', 'Something went wrong. Please try again.', '#dc2626'));
  }
});

// Reject: mark rejected, retain record
router.get('/signup-request/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { token } = req.query as { token?: string };

  if (!token || !pool) return res.status(400).send(actionPage('Error', 'Invalid request.', '#dc2626'));

  try {
    const row = await pool.query(
      'SELECT username, status, action_token FROM signup_requests WHERE id = $1',
      [id],
    );
    if (row.rows.length === 0) return res.send(actionPage('Not found', 'This request does not exist.', '#dc2626'));
    const req_ = row.rows[0];
    if (req_.action_token !== token) return res.status(403).send(actionPage('Unauthorized', 'Invalid rejection token.', '#dc2626'));
    if (req_.status !== 'pending') {
      return res.send(actionPage(
        'Already processed',
        `This request has already been <strong>${req_.status}</strong>.`,
        '#64748b',
      ));
    }

    await pool.query(
      `UPDATE signup_requests SET status = 'rejected', reviewed_at = NOW() WHERE id = $1`,
      [id],
    );

    res.send(actionPage('Request rejected', `The access request from <strong>${escapeHtml(req_.username)}</strong> has been rejected. The record is retained in the database.`, '#dc2626'));
  } catch (err) {
    console.error('[Auth] reject error:', (err as any)?.message);
    res.status(500).send(actionPage('Error', 'Something went wrong. Please try again.', '#dc2626'));
  }
});

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function actionPage(title: string, body: string, color: string) {
  const frontendUrl = process.env.FRONTEND_URL ?? '#';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title} — ClaimPilot</title></head>
<body style="margin:0;padding:40px 16px;background:#f8fbff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;box-sizing:border-box;">
  <div style="background:#fff;border-radius:16px;padding:40px 36px;max-width:480px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center;">
    <div style="width:52px;height:52px;border-radius:50%;background:${color}22;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:1.5rem;">
      ${color === '#16a34a' ? '✓' : color === '#dc2626' ? '✕' : 'ℹ'}
    </div>
    <h2 style="margin:0 0 10px;color:#0f172a;font-size:1.15rem;">${title}</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:0.88rem;line-height:1.6;">${body}</p>
    <a href="${frontendUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:11px 28px;border-radius:10px;font-weight:700;font-size:0.88rem;">Back to ClaimPilot</a>
  </div>
</body>
</html>`;
}

router.post('/logout', async (req, res) => {
  const { sessionId } = req.body as { sessionId?: string };
  if (sessionId) {
    memorySessions.delete(sessionId);
    if (pool) {
      try {
        await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
      } catch { /* ignore */ }
    }
  }
  res.json({ success: true });
});

export { router as authRouter };
