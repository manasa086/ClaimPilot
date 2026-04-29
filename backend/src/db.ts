import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      // Supabase pooler (pgbouncer) requires SSL
      ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : false,
    })
  : null;

export async function ensureConnected() {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured.');
  }
  await pool.query('SELECT 1');
}
