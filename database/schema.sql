-- ClaimPilot schema for incident reports, evidence, and exported packets

CREATE TABLE IF NOT EXISTS incident_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  reporter_role TEXT,
  vehicle TEXT,
  platform_status TEXT,
  incident_type TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE,
  location TEXT,
  description TEXT,
  damage_notes TEXT,
  injury_notes TEXT,
  other_party_details JSONB,
  witness_details JSONB,
  police_report_details JSONB,
  readiness_score INTEGER DEFAULT 0,
  missing_items TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id TEXT PRIMARY KEY,
  report_id TEXT REFERENCES incident_reports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  evidence_type TEXT,
  description TEXT,
  included_in_packet BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_packets (
  id TEXT PRIMARY KEY,
  report_id TEXT REFERENCES incident_reports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  readiness_score_at_generation INTEGER,
  generated_by_model TEXT,
  packet_status TEXT NOT NULL DEFAULT 'Draft'
);
