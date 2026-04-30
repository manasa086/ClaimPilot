# ClaimPilot — Architecture

## Overview

ClaimPilot is an AI-powered web application that helps rideshare and delivery drivers prepare complete, organized insurance claim packets after a vehicle incident.

The product does not submit claims or guarantee approval. Its job is to help a driver document facts, identify missing evidence, answer AI-generated follow-up questions, generate a professional narrative, and export a print-ready PDF — all without exposing the AI API key in the browser.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Plain CSS (`global.css`) + inline styles |
| Backend | Node.js + Express + TypeScript (`tsx` in dev, compiled in prod) |
| Database | Supabase (managed PostgreSQL via `pg` driver) |
| File storage | Supabase Storage (`claim-photos` bucket) |
| Primary AI | Anthropic Claude (`claude-opus-4-7`) |
| Fallback AI | OpenAI GPT-4o (switchable via `AI_PROVIDER` env var) |
| Email | Resend (HTTP-based, no SMTP) |
| Frontend hosting | Vercel |
| Backend hosting | Render (Dockerfile-based) |
| Local dev | Docker Compose (`Dockerfile.dev` per service) |

---

## Application modes

### Public demo mode (unauthenticated)
- Landing page with hero background and "How it works"
- Demo tab shows read-only claims from `incident_reports_dummy`
- No AI calls, no real data created or modified

### Authenticated driver mode
- Full claim CRUD on `incident_reports` (scoped to `user_id`)
- AI autofill on new report creation
- AI photo analysis on evidence upload
- AI-generated interview questions (persisted to DB on first fetch)
- AI narrative generation
- PDF export
- Readiness score calculated live and cached on save

---

## Request flow

```
Browser (React/Vite)
    │
    │  HTTPS — VITE_API_BASE_URL
    ▼
Express backend (Render)
    │
    ├─── requireAuth middleware ──► sessions table (Supabase)
    │
    ├─── /api/reports ────────────► incident_reports (Supabase Postgres)
    ├─── /api/demo/reports ───────► incident_reports_dummy (Supabase Postgres)
    ├─── /api/auth ───────────────► users / sessions / signup_requests
    ├─── /api/ai ─────────────────► Claude API  (or OpenAI, via AI_PROVIDER)
    └─── photo uploads ───────────► Supabase Storage (claim-photos bucket)
```

---

## Frontend structure

```
frontend/src/
├── App.tsx                     # Root: auth state, tab routing, report CRUD handlers
├── main.tsx                    # Vite entry point
├── pages/
│   ├── LandingPage.tsx         # Full-screen hero (background image + how it works)
│   └── LoginPage.tsx           # Login form + signup request modal
├── components/
│   ├── AppShell.tsx            # Header (dark navy), tab nav, layout wrapper
│   ├── ReportsHome.tsx         # Claims list with live readiness bars
│   ├── ReportDashboard.tsx     # Per-claim workspace: overview, interview, evidence, timeline, packet, review
│   └── NewReportForm.tsx       # Guided intake form with AI autofill
├── types/
│   └── incident.ts             # IncidentReport interface
└── utils/
    ├── ai.ts                   # AI helpers: autofill, narrative, interview questions
    ├── apiFetch.ts             # Fetch wrapper that injects session header
    ├── auth.ts                 # Session helpers: login, logout, verify, localStorage
    └── supabase.ts             # Supabase browser client (photo upload only)
```

### State management

No external state library. State lives in `App.tsx` and is passed as props:

- `authSession` — current logged-in session (null = unauthenticated)
- `reports` — live claims array (loaded on login, mutated on CRUD)
- `demoReports` — public demo claims (always loaded)
- `claimsView` — `'reports' | 'new-report' | 'dashboard'`
- `selectedReport` — currently open claim

`ReportDashboard` owns its own local state (edits in-flight) and calls `onReportUpdated` to push changes up to `App`.

### Readiness score formula

Calculated live in both `ReportDashboard` and `ReportsHome` using the same weights:

| Component | Weight | Metric |
|---|---|---|
| Core fields | 25% | 6 fields: title, vehicle, platform status, location, type, description |
| Evidence | 60% | Distinct `evidenceLabel` values in `photoUrls` out of 6 required |
| Interview | 15% | `interviewAnswers` count ÷ (7 static + AI question count) |

Score is also cached in `readiness_score` / `missing_items` on every save.

---

## Backend structure

```
backend/src/
├── index.ts                    # Express app: CORS, JSON, route mounting
├── db.ts                       # pg Pool from DATABASE_URL
├── routes/
│   ├── auth.ts                 # POST /login, GET /verify, POST /logout
│   │                           # POST /signup-request, GET /:id/approve, GET /:id/reject
│   ├── reports.ts              # GET/POST /reports, GET/PATCH/DELETE /reports/:id
│   ├── demo.ts                 # GET /demo/reports (no auth)
│   ├── ai.ts                   # POST /ai/autofill, /ai/narrative, /ai/photo, /ai/interview
│   └── health.ts               # GET /health
├── middleware/
│   └── requireAuth.ts          # Validates session token, injects req.userName
├── services/
│   ├── aiProvider.ts           # Delegates to claudeClient or openaiClient via AI_PROVIDER
│   ├── claudeClient.ts         # Claude integration: autofill, narrative, photo scan, interview Qs
│   ├── openaiClient.ts         # OpenAI integration (same interface as claudeClient)
│   ├── readinessAnalyzer.ts    # Deterministic readiness rules (fallback if AI unavailable)
│   └── emailService.ts         # Resend: signup approval / rejection emails with action links
└── types/
    └── api.ts                  # IncidentReport, AiQuestion, API response shapes
```

### Auth flow

1. `POST /api/auth/login` — validates username + password (DB lookup with bcrypt, or `AUTH_USERNAME`/`AUTH_PASSWORD` env-var fallback for local dev)
2. Creates a session row in `sessions` table with a 7-day expiry
3. Returns `{ sessionId, userName }` — stored in `localStorage` by the frontend
4. Every subsequent request sends `X-Session-Id` header → `requireAuth` middleware validates it

### AI provider abstraction

`aiProvider.ts` reads `AI_PROVIDER` at startup and exports a single `aiClient` that either wraps `claudeClient` or `openaiClient`. Both implement the same interface:

```ts
autofill(description: string): Promise<Partial<IncidentReport>>
generateNarrative(report: IncidentReport): Promise<string>
analyzePhoto(base64: string, mimeType: string, label: string): Promise<PhotoAnalysis>
generateInterviewQuestions(report: IncidentReport): Promise<AiQuestion[]>
```

Claude is the default (`AI_PROVIDER=claude`). Setting `AI_PROVIDER=openai` switches to OpenAI with no code changes.

### AI interview questions

Questions are fetched once per claim:
1. On `ReportDashboard` mount, checks if `report.aiQuestions` is already populated
2. If not, calls `/api/ai/interview` → Claude generates 3–5 questions with `type: 'yesno' | 'text'`
3. Questions are immediately PATCHed to the DB so they survive navigation
4. `yesno` questions render as Yes/No buttons; `text` questions render as a textarea

---

## Database schema

### `incident_reports`

```sql
id               TEXT PRIMARY KEY
user_id          TEXT DEFAULT 'local-user'
title            TEXT
status           TEXT DEFAULT 'Draft'
platform_status  TEXT
location         TEXT
incident_type    TEXT
vehicle          TEXT
description      TEXT
readiness_score  INTEGER DEFAULT 0
missing_items    TEXT[] DEFAULT '{}'
photo_urls       JSONB DEFAULT '[]'    -- [{url, evidenceLabel, aiAnalysis}]
interview_answers JSONB DEFAULT '{}'   -- {questionKey: answerString}
ai_questions     JSONB DEFAULT '[]'    -- [{id, question, type}]
created_at       TIMESTAMPTZ DEFAULT NOW()
updated_at       TIMESTAMPTZ DEFAULT NOW()
```

### `sessions`

```sql
id         TEXT PRIMARY KEY
user_name  TEXT NOT NULL
created_at TIMESTAMPTZ DEFAULT NOW()
expires_at TIMESTAMPTZ NOT NULL
```

### `signup_requests`

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
username      TEXT NOT NULL
password_hash TEXT NOT NULL
reason        TEXT NOT NULL
status        TEXT DEFAULT 'pending'   -- pending | approved | rejected
action_token  TEXT NOT NULL
requested_at  TIMESTAMPTZ DEFAULT NOW()
reviewed_at   TIMESTAMPTZ
```

---

## Docker setup

Two Dockerfiles exist per service:

| File | Purpose | Used by |
|---|---|---|
| `frontend/Dockerfile` | Production nginx static build | Render / CI |
| `frontend/Dockerfile.dev` | Vite dev server with hot reload | `docker-compose.yml` |
| `backend/Dockerfile` | Compiled `node dist/index.js` | Render / CI |
| `backend/Dockerfile.dev` | `tsx` watch mode (dev deps included) | `docker-compose.yml` |

`docker-compose.yml` points to `Dockerfile.dev` for both services and volume-mounts source directories so edits hot-reload without rebuilding the image.

`docker-compose.local.yml` adds a `postgres:16` container and sets `DATABASE_URL` to the local instance, enabling fully-offline development.

---

## Deployment

| Service | Platform | Dockerfile used | Notes |
|---|---|---|---|
| Frontend | Vercel | (Vite build, no Docker) | `VITE_*` env vars baked at build time |
| Backend | Render | `backend/Dockerfile` | Auto-deploys on push; free tier cold-starts after 15 min idle |
| Database | Supabase | — | Managed PostgreSQL + Storage |
| Email | Resend | — | HTTP API, no SMTP, free tier 3k/month |

### Vite environment variables

Vite bakes `VITE_*` variables at **build time**, not runtime. They must be set in Vercel's environment settings before the build runs. Runtime env injection is not supported without a custom server.

---

## Non-goals (current version)

- Real insurance submission or platform API integrations
- Claim approval prediction or legal advice
- Multi-user collaboration on a single claim
- Mobile-native app (web-responsive only)
- Adjuster-facing workflow
