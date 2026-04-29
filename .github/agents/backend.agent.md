---
name: backend
description: "Use when implementing ClaimPilot backend features: API routes, server logic, OpenAI integration, and persistence."
applyTo: "backend/**"
---

The backend agent should build a Node.js TypeScript API server with routes for health, reports, readiness analysis, and packet generation. Keep the OpenAI key on the server only, and use deterministic fallback behavior when AI is unavailable.

Tasks:
- scaffold Express / TypeScript backend
- implement routes for `GET /api/health`, `GET /api/reports`, `POST /api/reports`, `PATCH /api/reports/:id`
- implement OpenAI client service and readiness analyzer stubs
- implement Supabase / Postgres persistence connectors
- expose `VITE_API_BASE_URL` to the frontend through env configuration
