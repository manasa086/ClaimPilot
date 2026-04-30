# ClaimPilot

AI-powered claim documentation assistant for rideshare and delivery drivers. Guides users through every step of documenting a vehicle incident — from plain-English description to a print-ready PDF packet.

**Live app:** https://claimpilot.vercel.app  
**Backend API:** https://claimpilot-wvhi.onrender.com

---

## Screenshots

**Landing Page** — full-screen hero with background image and "How it works"

![Landing Page](docs/screenshots/01-dashboard-claims-list.png)

**Individual Claim Overview** — readiness, missing items, evidence status, and AI risk flags

![Claim Overview](docs/screenshots/02-claim-overview.png)

**Full Incident Summary** — complete structured record with description, evidence checklist, and readiness score

![Incident Summary Modal](docs/screenshots/03-incident-summary-modal.png)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│          React + TypeScript (Vite)  — Vercel CDN            │
│                                                             │
│  Tabs: Home │ Login │ Dashboard (Demo when logged out)      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS  (VITE_API_BASE_URL)
┌──────────────────────▼──────────────────────────────────────┐
│                    Backend API                              │
│          Node.js + Express + TypeScript  — Render           │
│                                                             │
│  /api/auth               — login / verify / logout          │
│  /api/auth/signup-request — request access (+ email admin)  │
│  /api/auth/:id/approve   — approve user (+ mailto button)   │
│  /api/auth/:id/reject    — reject request                   │
│  /api/reports            — authenticated CRUD (per-user)    │
│  /api/demo/reports       — public read-only (dummy table)   │
│  /api/ai                 — autofill, narrative, photo scan  │
│  /api/health             — health check                     │
└──────┬──────────────────────────────┬───────────────────────┘
       │ pg (DATABASE_URL)            │ Anthropic SDK / OpenAI SDK
┌──────▼──────────────┐     ┌─────────▼──────────┐
│     Supabase        │     │  External Services  │
│   PostgreSQL        │     │                     │
│                     │     │  Claude API         │
│  incident_reports   │     │  (claude-opus-4-7)  │
│  incident_reports   │     │                     │
│    _dummy           │     │  OpenAI (optional)  │
│  users              │     │                     │
│  sessions           │     │  Resend             │
│  signup_requests    │     │  (email via HTTPS)  │
│                     │     └─────────────────────┘
│  Supabase Storage   │
│  (claim-photos)     │
└─────────────────────┘
```

### Key design decisions

| Decision | Reason |
|---|---|
| Per-user data isolation via `user_id` | Each user only sees their own claims; filtered on every DB query |
| `signup_requests` table + admin email flow | Self-serve access requests — admin approves/rejects via email links |
| Resend over SMTP (nodemailer) | Cloud platforms (Render) block outbound SMTP; Resend uses HTTPS |
| `incident_reports_dummy` separate table | Public demo data is isolated — live claims never exposed unauthenticated |
| Supabase Storage for photos | Signed URLs with long TTL survive server restarts; base64 sent to AI for image analysis |
| `AI_PROVIDER` env var | Swap between Claude and OpenAI without code changes |
| `interview_answers` + `ai_questions` persisted to DB | Answers and AI-generated questions survive navigation and page refresh |
| Three-part readiness formula (25% fields · 60% evidence · 15% interview) | Weights reflect what insurers actually need most |
| Separate `Dockerfile` (prod) and `Dockerfile.dev` (dev) per service | Production builds use nginx/compiled node; dev containers use live-reload with tsx/vite |
| `requireAuth` middleware on `/api/reports` | Session validated on every request; `user_id` injected from session |

---

## User access flow

1. New user visits the app → clicks **Request access** on the Login page
2. Fills in username, password, and reason → submitted to `signup_requests` table
3. Admin receives an email (via Resend) with **Approve** / **Reject** buttons
4. **Approve** → user added to `users` table, admin gets a mailto button to notify user
5. **Reject** → request marked rejected, record retained in DB
6. User can now sign in with their username + password

---

## Running locally

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- `.env` file in the project root (copy values from the team vault or ask Manasa)

### Option A — Supabase (cloud database, recommended)

```bash
git clone https://github.com/manasa086/ClaimPilot.git
cd ClaimPilot
docker-compose up --build
```

App is at **http://localhost:5173**

> `docker-compose.yml` uses `Dockerfile.dev` for both services — Vite dev server on the frontend, `tsx` watch on the backend. Source files are volume-mounted so changes hot-reload without rebuilding.

### Option B — Local PostgreSQL (fully offline)

```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

- Starts a `postgres:16` container automatically
- `docker/init.sql` creates all tables on first boot
- Login uses `AUTH_USERNAME` / `AUTH_PASSWORD` from `.env` (env-var fallback)

To reset the local database:
```bash
docker-compose down -v
docker-compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

### Stopping

```bash
docker-compose down        # stop, keep data
docker-compose down -v     # stop and wipe local postgres
```

---

## Environment variables

All variables live in `.env` at the project root.

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Frontend | Backend URL (`http://localhost:3001` locally) |
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL (photo uploads) |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anon key |
| `VITE_AI_PROVIDER` | Frontend | Badge display (`claude` or `openai`) |
| `AI_PROVIDER` | Backend | Which AI client to use (`claude` or `openai`) |
| `ANTHROPIC_API_KEY` | Backend | Claude API key |
| `OPENAI_API_KEY` | Backend | OpenAI API key (if using OpenAI) |
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `SUPABASE_URL` | Backend | Supabase project URL |
| `SUPABASE_ANON_KEY` | Backend | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Supabase service role (storage ops) |
| `AUTH_USERNAME` | Backend | Fallback login username (local dev) |
| `AUTH_PASSWORD` | Backend | Fallback login password (local dev) |
| `FRONTEND_URL` | Backend | Allowed CORS origin |
| `BACKEND_URL` | Backend | Public backend URL (used in email approve/reject links) |
| `RESEND_API_KEY` | Backend | Resend API key for email sending |
| `ADMIN_EMAIL` | Backend | Email address that receives access request notifications |

---

## Project structure

```
ClaimPilot/
├── frontend/
│   ├── public/
│   │   ├── hero-bg.png               # Landing page background image
│   │   └── dashboard-screenshot.png  # Hero illustration (real app screenshot)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx       # Full-screen hero + how it works
│   │   │   └── LoginPage.tsx         # Login + signup request modal
│   │   ├── components/
│   │   │   ├── AppShell.tsx          # Header, tab navigation, layout wrapper
│   │   │   ├── ReportsHome.tsx       # Claims list with readiness scores
│   │   │   ├── ReportDashboard.tsx   # Per-claim workspace (overview, interview, evidence…)
│   │   │   └── NewReportForm.tsx     # New claim intake form with AI autofill
│   │   ├── types/
│   │   │   └── incident.ts           # IncidentReport type definition
│   │   └── utils/
│   │       ├── ai.ts                 # AI autofill, narrative, interview question helpers
│   │       ├── apiFetch.ts           # Authenticated fetch wrapper
│   │       ├── auth.ts               # Session storage, login/logout/verify
│   │       └── supabase.ts           # Supabase client (photo uploads)
│   ├── Dockerfile                    # Production build (nginx static)
│   └── Dockerfile.dev                # Dev server (node + vite)
├── backend/
│   └── src/
│       ├── routes/
│       │   ├── auth.ts               # Login, logout, verify, signup requests, approve/reject
│       │   ├── reports.ts            # Authenticated CRUD for incident_reports
│       │   ├── demo.ts               # Public read-only demo reports
│       │   ├── ai.ts                 # AI endpoints (autofill, narrative, photo scan, interview)
│       │   └── health.ts             # Health check
│       ├── middleware/
│       │   └── requireAuth.ts        # Session validation + user_id injection
│       ├── services/
│       │   ├── aiProvider.ts         # Routes to Claude or OpenAI based on AI_PROVIDER
│       │   ├── claudeClient.ts       # Claude API integration (primary)
│       │   ├── openaiClient.ts       # OpenAI integration (fallback)
│       │   ├── readinessAnalyzer.ts  # Deterministic readiness rules
│       │   └── emailService.ts       # Resend email for signup approval flow
│       ├── types/
│       │   └── api.ts                # Shared API types
│       ├── db.ts                     # Supabase/postgres client
│       └── index.ts                  # Express app entry point
│   ├── Dockerfile                    # Production build (compiled node)
│   └── Dockerfile.dev                # Dev server (node + tsx watch)
├── docker/
│   └── init.sql                      # Schema for local PostgreSQL
├── docs/
│   └── screenshots/                  # App screenshots for README
├── docker-compose.yml                # Default (Supabase + dev Dockerfiles)
├── docker-compose.local.yml          # Override for local PostgreSQL
├── dev-cloud.sh                      # Shortcut: docker-compose up (Supabase)
└── dev-local.sh                      # Shortcut: docker-compose local up
```

---

## Database schema

| Table | Purpose |
|---|---|
| `users` | Authorized users — username + bcrypt password hash |
| `sessions` | Active login sessions with expiry |
| `signup_requests` | Access requests from the login page (pending / approved / rejected) |
| `incident_reports` | Live claim data — scoped per `user_id` |
| `incident_reports_dummy` | Read-only demo data — public, never written to by the app |

### `incident_reports` columns

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Client-generated UUID |
| `user_id` | TEXT | Scoped to authenticated user |
| `title` | TEXT | AI-extracted or manual |
| `status` | TEXT | `Draft` or `Completed` |
| `platform_status` | TEXT | e.g. "Uber trip active" |
| `location` | TEXT | Incident location |
| `incident_type` | TEXT | e.g. "Rear-end collision" |
| `vehicle` | TEXT | Vehicle make/model/year |
| `description` | TEXT | Full incident description |
| `readiness_score` | INTEGER | Cached score (0–100) |
| `missing_items` | TEXT[] | Cached missing field labels |
| `photo_urls` | JSONB | Array of `{url, evidenceLabel, aiAnalysis}` |
| `interview_answers` | JSONB | Map of question key → answer string |
| `ai_questions` | JSONB | AI-generated follow-up questions with `type` field |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

> If upgrading an existing Supabase project, run:
> ```sql
> ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS interview_answers JSONB DEFAULT '{}'::jsonb;
> ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS ai_questions JSONB DEFAULT '[]'::jsonb;
> ```

---

## Claim readiness formula

Readiness is calculated on both the frontend (live) and stored on save:

| Component | Weight | Metric |
|---|---|---|
| Core fields | 25% | 6 required fields: title, vehicle, platform status, location, type, description |
| Evidence | 60% | Distinct evidence labels uploaded out of 6 required types |
| Interview | 15% | Questions answered out of total (7 static + AI-generated) |

---

## Deployment

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploys on `git push` to main; Vite bakes `VITE_*` env vars at build time |
| Backend | Render | Dockerfile-based (production `Dockerfile`); free tier spins down after 15 min idle |
| Database | Supabase | Managed PostgreSQL + Storage |
| Email | Resend | HTTP-based (no SMTP); free tier 3,000 emails/month |

### Adding a new env var
1. Add to `.env` locally
2. Add to Render → Environment (backend vars)
3. Add to Vercel → Settings → Environment Variables (`VITE_` prefix vars only)
4. Redeploy both services

### Managing user access
- **Grant access:** approve via email link → user added to `users` table
- **Revoke access:** run in Supabase SQL Editor:
```sql
DELETE FROM users WHERE LOWER(username) = 'username_here';
DELETE FROM sessions WHERE user_name = 'username_here';
DELETE FROM incident_reports WHERE user_id = 'username_here';
```
