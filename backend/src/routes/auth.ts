import express from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';

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
