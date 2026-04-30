-- ClaimPilot — PostgreSQL init script
-- Used automatically by Docker Compose when the db container first starts.
-- Also run manually in Supabase SQL Editor to set up cloud tables.

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Users (authentication) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Local dev auth uses the AUTH_USERNAME / AUTH_PASSWORD env vars as a fallback,
-- so you do NOT need to seed the users table here.
-- If you want DB-based auth locally (optional), run this once with your actual password:
-- INSERT INTO users (username, password_hash)
-- VALUES ('manasa', crypt('your_password', gen_salt('bf')))
-- ON CONFLICT (username) DO NOTHING;

-- ── Sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_name  TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

-- ── Main incident reports (live data — only accessible when authenticated) ────
CREATE TABLE IF NOT EXISTS incident_reports (
  id               TEXT PRIMARY KEY,
  user_id          TEXT DEFAULT 'local-user',
  title            TEXT,
  status           TEXT DEFAULT 'Draft',
  platform_status  TEXT,
  location         TEXT,
  incident_type    TEXT,
  vehicle          TEXT,
  description      TEXT,
  readiness_score    INTEGER DEFAULT 0,
  missing_items      TEXT[] DEFAULT '{}',
  photo_urls         JSONB DEFAULT '[]'::jsonb,
  interview_answers  JSONB DEFAULT '{}'::jsonb,
  ai_questions       JSONB DEFAULT '[]'::jsonb,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Demo/public reports (read-only via /api/demo/reports) ─────────────────────
-- Populated once from incident_reports (see migration below).
-- The API only exposes GET on this table — never write from the app.
CREATE TABLE IF NOT EXISTS incident_reports_dummy (
  id               TEXT PRIMARY KEY,
  user_id          TEXT DEFAULT 'demo-user',
  title            TEXT,
  status           TEXT DEFAULT 'Draft',
  platform_status  TEXT,
  location         TEXT,
  incident_type    TEXT,
  vehicle          TEXT,
  description      TEXT,
  readiness_score  INTEGER DEFAULT 0,
  missing_items    TEXT[] DEFAULT '{}',
  photo_urls       JSONB DEFAULT '[]'::jsonb,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Signup requests (access requests from the login page) ────────────────────
CREATE TABLE IF NOT EXISTS signup_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  action_token  TEXT NOT NULL,
  requested_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at   TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS signup_requests_status_idx ON signup_requests (status);

-- ── One-time data migration ───────────────────────────────────────────────────
-- Copies current live records into the dummy table (idempotent).
-- Run this ONCE after creating the dummy table. After that, manage demo
-- data directly in incident_reports_dummy via Supabase/psql.
-- Uncomment and run:
-- INSERT INTO incident_reports_dummy SELECT * FROM incident_reports
-- ON CONFLICT (id) DO NOTHING;
