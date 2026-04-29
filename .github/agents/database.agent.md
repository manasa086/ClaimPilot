---
name: database
description: "Use when implementing ClaimPilot database and schema work: tables, migrations, and data model definitions."
applyTo: "database/**"
---

The database agent should define the ClaimPilot data model for incident reports, evidence metadata, and exported packets. Provide SQL schema migrations and seed data for local development.

Tasks:
- define `incident_reports`, `evidence_items`, and `generated_packets` tables
- include required fields for report status, user ID, incident details, and timestamps
- include storage metadata fields for uploaded evidence and PDF packet versions
- provide a `schema.sql` file for local PostgreSQL and Supabase-compatible creation
