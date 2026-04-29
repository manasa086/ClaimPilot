# ClaimPilot

AI-powered claim documentation assistant for rideshare and delivery drivers. Guides users through every step of documenting a vehicle incident — from plain-English description to a print-ready PDF packet.

**Live production system:** https://railway.com/project/2447168d-3da2-4e4b-9562-bb566a803855/service/d013240c-475a-491b-bd7c-d92f23588593?environmentId=0da4939d-7d89-4c06-93cb-c4dd7f179ef6

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
│          Node.js + Express + TypeScript  — Railway          │
│                                                             │
│  /api/auth          — login / verify / logout               │
│  /api/reports       — authenticated CRUD (live claims)      │
│  /api/demo/reports  — public read-only (dummy table)        │
│  /api/ai            — AI autofill, narrative, photo scan    │
└──────┬─────────────────────────────────┬────────────────────┘
       │ pg (DATABASE_URL)               │ Anthropic SDK
┌──────▼──────────────┐        ┌─────────▼──────────┐
│     Supabase        │        │   Claude API        │
│   PostgreSQL        │        │  (claude-opus-4-7)  │
│                     │        └────────────────────-┘
│  incident_reports   │
│  incident_reports   │
│    _dummy           │
│  users              │
│  sessions           │
│                     │
│  Supabase Storage   │
│  (claim-photos)     │
└─────────────────────┘
```

### Key design decisions

| Decision | Reason |
|---|---|
| Single-user auth via `users` table + pgcrypto | Simple, no third-party auth dependency |
| `incident_reports_dummy` separate table | Public demo data is isolated — live claims never exposed unauthenticated |
| Supabase Storage for photos | Signed URLs with long TTL survive server restarts; base64 URLs sent to Claude for AI analysis |
| `AI_PROVIDER` env var | Swap between Claude and OpenAI without code changes |
| Docker Compose override file for local postgres | One command switches between Supabase and local DB |

---

## Running locally

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- `.env` file in the project root (copy the values from the team vault or ask Manasa)

### Option A — Supabase (cloud database, recommended)

```bash
# Clone the repo
git clone https://github.com/manasa086/ClaimPilot.git
cd ClaimPilot

# Start frontend + backend (points at Supabase)
docker-compose up --build
```

App is at **http://localhost:5173**

### Option B — Local PostgreSQL (fully offline)

```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

- Starts a `postgres:16` container automatically
- `docker/init.sql` creates all tables on first boot
- Login uses `AUTH_USERNAME` / `AUTH_PASSWORD` from `.env` (env-var fallback, no DB seed needed)

To reset the local database from scratch:
```bash
docker-compose down -v
docker-compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

### Stopping

```bash
# Stop containers (keep data)
docker-compose down

# Stop and wipe local postgres data
docker-compose down -v
```

---

## Environment variables

All variables live in `.env` at the project root.

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Frontend | Backend URL (http://localhost:3001 locally) |
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL (photo uploads) |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anon key |
| `VITE_AI_PROVIDER` | Frontend | Badge display (`claude` or `openai`) |
| `AI_PROVIDER` | Backend | Which AI client to use |
| `ANTHROPIC_API_KEY` | Backend | Claude API key |
| `OPENAI_API_KEY` | Backend | OpenAI API key (if using OpenAI) |
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Supabase service role (storage ops) |
| `AUTH_USERNAME` | Backend | Login username |
| `AUTH_PASSWORD` | Backend | Login password |
| `FRONTEND_URL` | Backend | Allowed CORS origin |

---

## Project structure

```
ClaimPilot/
├── frontend/               # Vite + React + TypeScript
│   └── src/
│       ├── pages/          # LandingPage, LoginPage
│       ├── components/     # AppShell, ReportDashboard, ReportsHome, …
│       └── utils/          # auth.ts, ai.ts, supabase.ts
├── backend/                # Node.js + Express + TypeScript
│   └── src/
│       ├── routes/         # auth, reports, demo, ai, health
│       └── services/       # claudeClient, openaiClient, aiProvider
├── docker/
│   └── init.sql            # Schema for local PostgreSQL
├── docker-compose.yml          # Default (Supabase)
├── docker-compose.local.yml    # Override for local PostgreSQL
├── dev-cloud.sh                # Shortcut: docker-compose up (Supabase)
└── dev-local.sh                # Shortcut: docker-compose local up
```

---

## Deployment

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploys on `git push` to main |
| Backend | Railway | Dockerfile-based, auto-deploys on push |
| Database | Supabase | Managed PostgreSQL + Storage |

### Adding a new env var
1. Add to `.env` locally
2. Add to Railway → Variables (backend vars)
3. Add to Vercel → Settings → Environment Variables (VITE_ prefix vars only)
4. Redeploy both services
