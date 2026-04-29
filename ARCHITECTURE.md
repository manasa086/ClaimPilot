# ClaimPilot Architecture

## Goal

ClaimPilot is an OpenAI-powered web application that helps rideshare and delivery drivers prepare complete, organized insurance claim packets after an accident or safety incident.

The product should not guarantee claim approval or submit claims directly. Its job is to help a driver document facts, identify missing evidence, answer follow-up questions, generate a professional PDF packet, and provide AI-assisted claim readiness guidance that can be shared with an insurer, platform support team, attorney, or personal records.

## Product Shape

ClaimPilot is driver-facing, not adjuster-facing. Most drivers will have zero or one active incident, and only a small number of past reports. The application should therefore start with an incident report list, not a permanent operations sidebar.

Primary screens:

1. Reports Home
2. New Report Flow
3. Claim Workspace
4. Final Review and PDF Export

## Application Modes

ClaimPilot has two user-facing modes:

1. Public Demo Mode
2. Authenticated Driver Mode

### Public Demo Mode

Unauthenticated users should see dummy pages that explain and demonstrate the application's capabilities without accessing real claim creation.

Public pages should include:

- product overview
- example incident report
- sample readiness analysis
- sample PDF packet preview
- explanation of AI-powered follow-up questions
- sign in or request access action

Public demo mode must not store real driver data or call paid OpenAI workflows unless explicitly configured for demo use.

The public demo pages should look like the real product but use static sample data.

Public demo pages:

- Home / capability overview
- Sample reports list
- Sample claim workspace
- Sample readiness analysis
- Sample PDF packet preview
- Sign in / request access

### Authenticated Driver Mode

After deployment, authorized users can access the real application.

Authenticated users can:

- create incident reports
- save drafts
- upload evidence
- receive OpenAI-powered follow-up questions
- run claim readiness analysis
- generate claim summaries
- export claim packets as PDF
- view past reports

Access rule:

```txt
Unauthenticated visitor -> public demo pages only
Authenticated user       -> real driver application
```

## Phase 1: Local OpenAI-Powered App

### Stack

- React
- TypeScript
- Vite
- Plain CSS or SCSS
- Vercel-style API routes for the deployable backend
- Docker Compose for local frontend/backend testing
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Server-side OpenAI integration
- Browser local state for active editing
- localStorage only for temporary unsaved form recovery during development
- Client-side PDF generation
- Backend API for AI analysis and report generation
- Supabase-backed persistence during local development
- Local auth test user for development
- Real authentication before production launch
- No OpenAI API key in the browser

### Selected Hosting Architecture

ClaimPilot should use this stack unless there is a strong reason to change later:

```txt
Vercel
  - Hosts the React web app
  - Hosts backend API routes
  - Stores server-side environment variables
  - Provides preview deployments

Supabase
  - Handles user authentication
  - Stores incident reports in Postgres
  - Stores uploaded evidence files
  - Enforces user-level access with row-level security

OpenAI
  - Generates claim readiness analysis
  - Suggests follow-up questions
  - Rewrites driver notes into neutral factual language
  - Generates final claim summaries
```

This keeps the infrastructure simple and low-cost:

- Vercel Hobby can run the frontend and API routes for early testing.
- Supabase Free can support the first version of auth, database, and storage.
- OpenAI usage is the main variable cost and should be protected with strict usage limits.

GCP is not part of the selected architecture for the first version.

### Why Backend First

ClaimPilot should include a backend from the beginning because the core product is OpenAI-powered and the OpenAI API key must never be exposed in frontend code.

The backend is needed to:

- create and reopen incident report drafts
- ask structured claim intake questions
- run OpenAI-powered claim readiness analysis
- generate neutral insurance-ready summaries from messy driver notes
- suggest follow-up questions
- identify missing information and weak evidence
- keep deterministic readiness rules as a fallback
- preview uploaded evidence in the browser
- generate a structured claim packet
- export a PDF, text, or JSON backup
- separate public demo pages from authenticated real functionality

The frontend must call the application backend, and the backend must call OpenAI.

```txt
React app -> ClaimPilot backend -> OpenAI API
```

The frontend must never call OpenAI directly.

## Core User Flow

### 1. Reports Home

The user opens ClaimPilot and sees a simple list of incident reports.

Each incident card shows:

- incident title
- incident date
- vehicle
- platform status if known
- claim status: Draft, Needs Review, Ready, Exported
- readiness score
- missing item count
- last updated time
- primary action: Continue Report, Review, or Open Packet

The page also includes a prominent Start New Report action.

### 2. New Report Flow

The user starts with a short guided intake:

- What happened?
- When did it happen?
- Where did it happen?
- Were you actively driving for a rideshare or delivery platform?
- Was a passenger or delivery active?
- Was anyone injured or reporting pain?
- Was there vehicle or property damage?
- Were police called?
- Do you have photos, witnesses, other driver details, or insurance info?

The flow should use quick choices first, then structured fields only when needed.

### 3. Claim Workspace

After opening an incident, the user sees a focused workspace for one claim.

Recommended top navigation:

```txt
ClaimPilot | Back to reports | Draft saved | Save Draft | Export PDF
```

Recommended workspace tabs:

```txt
Overview | Interview | Evidence | Packet Preview | Final Review
```

No permanent left sidebar is required.

### 4. Final Review and Export

Before PDF export, ClaimPilot should show:

- readiness score
- missing required information
- recommended supporting evidence
- risk flags
- unanswered follow-up questions
- final PDF preview

The app can still allow export with missing information, but it should label the packet clearly as incomplete.

## Claim Readiness Engine

The readiness engine is the core product feature. It should combine deterministic rules with OpenAI analysis.

It should evaluate the report and produce:

- missing required fields
- recommended missing evidence
- risk flags
- follow-up questions
- readiness score
- export status

Example rules:

- If injury is mentioned but medical follow-up is missing, ask whether anyone requested care or later reported symptoms.
- If passenger was onboard but no trip ID is present, ask for the rideshare trip ID or receipt.
- If another driver was involved but no plate, contact, or insurance details are present, ask for the missing party information.
- If vehicle damage exists but no photos are attached, warn that photos usually strengthen damage documentation.
- If police report filed is true but no report number or agency is present, ask for those details.
- If location is vague, ask for an address, intersection, parking lot name, or landmark.
- If fault language appears in the driver's note, encourage factual wording without legal conclusions.

The readiness engine must not say a claim will be approved or denied.

### Deterministic Rules

Deterministic rules should handle obvious checks reliably:

- required field completeness
- missing photos
- missing police report number
- missing trip ID
- missing other driver details
- vague location
- missing injury follow-up

### OpenAI-Powered Analysis

OpenAI should handle judgment-heavy assistance:

- rewrite driver notes into neutral factual language
- detect vague, contradictory, emotional, or fault-admitting language
- suggest the next best question
- extract structured facts from messy notes
- identify claim packet weaknesses
- explain why an item may matter to an insurer
- generate a clean claim summary
- generate a final review checklist before export

OpenAI output should be treated as advisory. The UI must make clear that ClaimPilot does not provide legal, medical, insurance, or claim approval advice.

## Data Model

The frontend should keep an array of incident reports.

```txt
ClaimStore
  reports: IncidentReport[]
  activeReportId?: string
```

Each `IncidentReport` should include:

- id
- title
- status
- createdAt
- updatedAt
- reporter role
- driver details
- vehicle details
- incident type
- ride or delivery platform context
- date and time
- location
- description
- damage notes
- injury notes
- other party details
- witness details
- police report details
- evidence items
- export history

Evidence should support more than photos over time:

- damage photos
- license plate photos
- insurance card photos
- police report files
- trip receipt screenshots
- platform support screenshots
- witness contact notes

## File Storage

ClaimPilot should store user-uploaded evidence and generated claim PDFs in Supabase Storage.

Storage buckets:

```txt
claim-evidence
  Stores user-uploaded evidence files.

claim-packets
  Stores generated PDF claim packets if the user chooses to save the export.
```

Recommended storage paths:

```txt
claim-evidence/{userId}/{reportId}/{evidenceId}-{safeFileName}
claim-packets/{userId}/{reportId}/claim-packet-{version}.pdf
```

Evidence file metadata should be stored in Postgres, not only in Storage.

Evidence metadata fields:

- id
- reportId
- userId
- bucket
- storagePath
- originalFileName
- fileType
- fileSize
- evidenceType
- uploadedAt
- description
- includedInPacket

Generated PDF metadata fields:

- id
- reportId
- userId
- bucket
- storagePath
- version
- generatedAt
- readinessScoreAtGeneration
- generatedByModel
- packetStatus: Draft, Incomplete, Ready, Exported

Access rules:

- Files must not be public by default.
- Users can access only files under their own `userId`.
- Supabase row-level security should protect file metadata.
- Supabase Storage policies should protect the underlying file objects.
- Public demo pages must use static sample assets, not real user uploads.

PDF storage behavior:

- A PDF can be generated locally for immediate browser download.
- If the user is authenticated, the final generated PDF should also be uploaded to `claim-packets`.
- Each saved PDF should be versioned so older exported packets are not overwritten.
- If a report changes after PDF export, the UI should mark the saved PDF as potentially outdated.

Retention:

- Uploaded evidence should remain until the user deletes the report or deletes the file.
- Generated PDFs can be regenerated, but saved export versions should remain available unless deleted by the user.
- Later production settings should include account deletion and data export behavior.

## Claim Packet Generation

The generated packet should be insurance-ready in structure and conservative in language. The packet can use OpenAI-generated summaries, but the final PDF structure should be deterministic and predictable.

PDF sections:

1. Claim Summary
2. Incident Timeline
3. Driver Information
4. Vehicle Information
5. Rideshare or Delivery Platform Status
6. Incident Details
7. Damage Description
8. Injury Description
9. Other Parties
10. Witnesses
11. Police Report
12. Evidence Attached
13. Missing or Follow-Up Items
14. Driver Certification
15. Disclaimer

The packet should clearly state that ClaimPilot is a documentation assistant and does not provide legal, medical, insurance, or claim approval advice.

## Frontend Modules

Recommended module structure:

```txt
src/
  App.tsx
  main.tsx
  styles/
    global.scss
  components/
    AppShell.tsx
    ReportsHome.tsx
    IncidentCard.tsx
    NewReportFlow.tsx
    ClaimWorkspace.tsx
    WorkspaceTabs.tsx
    OverviewDashboard.tsx
    InterviewPanel.tsx
    EvidencePanel.tsx
    PacketPreview.tsx
    FinalReview.tsx
    ExportReportButton.tsx
  lib/
    apiClient.ts
    claimGenerator.ts
    demoCase.ts
    exportReport.ts
    readinessEngine.ts
    storage.ts
    validation.ts
  types/
    incident.ts
```

## Backend Modules

Recommended backend structure:

```txt
server/
  index.ts
  routes/
    auth.ts
    reports.ts
    readiness.ts
    packet.ts
  services/
    openaiClient.ts
    readinessAnalyzer.ts
    summaryGenerator.ts
    packetGenerator.ts
    reportStore.ts
  prompts/
    readinessPrompt.ts
    summaryPrompt.ts
    followUpPrompt.ts
  types/
    api.ts
```

For local development, Docker Compose should run the frontend and backend locally while connecting to Supabase and OpenAI through environment variables.

## API Design

Local development should run both the frontend and backend.

Recommended local URLs:

```txt
Frontend: http://localhost:5173
Backend:  http://localhost:3001
```

Recommended scripts:

```txt
npm run dev
npm run dev:server
npm run dev:all
```

Core API endpoints:

```txt
GET    /api/health
GET    /api/demo/reports
POST   /api/reports
GET    /api/reports
GET    /api/reports/:id
PATCH  /api/reports/:id
POST   /api/reports/:id/analyze-readiness
POST   /api/reports/:id/generate-summary
POST   /api/reports/:id/suggest-follow-up
POST   /api/reports/:id/generate-packet
POST   /api/reports/:id/export-pdf
```

OpenAI-backed endpoints:

```txt
POST /api/reports/:id/analyze-readiness
POST /api/reports/:id/generate-summary
POST /api/reports/:id/suggest-follow-up
POST /api/reports/:id/generate-packet
```

The frontend should degrade gracefully if OpenAI is unavailable by showing deterministic readiness results and a clear AI-unavailable status.

## UI Requirements

The application should match the approved mock direction: a calm, professional claims-preparation web app with a reports home first and a focused claim workspace after the user opens an incident.

It should feel more like a serious insurance workflow tool than a consumer chatbot, landing page, or adjuster operations console.

Reports Home:

- no marketing hero
- no permanent sidebar
- clear Start New Report action
- centered content area with a max-width layout
- incident cards or rows as the main content
- obvious report status badges
- lightweight empty state for first-time users
- public demo users should see sample report cards with dummy data
- authenticated users should see their real report list from Supabase

Reports Home layout:

```txt
Top bar
  ClaimPilot                         Sign in / Account

Main
  Your incident reports              Start New Report

  [Needs Review] Toyota Camry collision
  Apr 24, 2026 · Uber trip active · 68% ready
  Missing: police report, other driver insurance, photos
  Continue Report

  [Draft] Passenger reported neck pain
  Apr 10, 2026 · Lyft ride completed · 42% ready
  Continue Report
```

Claim Workspace:

- top navigation with Back to reports, Save Draft, and Export PDF
- horizontal tabs instead of a sidebar
- overview dashboard focused on readiness and next best action
- live PDF-style packet preview
- missing information and risk flags visible before export
- dense but readable layout for desktop web

Claim Workspace layout:

```txt
Top bar
  ClaimPilot | Back to reports | Draft saved | Save Draft | Export PDF

Tabs
  Overview | Interview | Evidence | Packet Preview | Final Review

Overview
  Claim Readiness     Next Best Question      Incident Summary
  Missing Info        Risk Flags              Claim Packet Preview
  Evidence Status     AI Notes                Export Checklist
```

Overview page priorities:

- show the readiness score immediately
- show the next best question generated by rules or OpenAI
- show missing information before showing secondary details
- show a PDF-style packet preview on the right side for desktop
- keep the page action-oriented, not informational

Visual style:

- white and light gray canvas
- deep navy top bar
- charcoal text
- blue primary actions
- amber warning states
- green completion indicators
- red only for critical gaps
- 8px card radius or less
- no decorative landing-page hero treatment
- no gradient hero sections
- no permanent side navigation
- no oversized marketing copy
- no nested cards inside cards

Suggested design tokens:

```txt
Background:      #f5f7fa
Surface:         #ffffff
Border:          #d8e0e8
Text strong:     #18212f
Text muted:      #687386
Navy header:     #071d2b
Primary blue:    #2563eb
Success green:   #15803d
Warning amber:   #b45309
Critical red:    #b91c1c
Card radius:     8px
Control radius:  8px
```

Primary UI components:

- AppTopBar
- ReportsHome
- IncidentCard
- NewReportButton
- ClaimWorkspace
- WorkspaceTabs
- ReadinessScoreCard
- NextBestQuestionCard
- MissingInformationList
- RiskFlagsPanel
- EvidenceStatusPanel
- PacketPreviewPanel
- ExportChecklist

## Local Development

Local testing should support the real OpenAI-powered workflow.

Local development should use Docker Compose as the standard path.

Required environment variables:

```txt
OPENAI_API_KEY=...
VITE_API_BASE_URL=http://localhost:3001
AUTH_MODE=local
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Local behavior:

- public demo pages are available without login
- authenticated app can use a local test user
- OpenAI calls go through the backend only
- drafts are saved to Supabase when credentials are configured
- PDF export can be tested locally
- uploaded evidence and generated PDFs can be tested against Supabase Storage

## Docker Setup

Docker is required for the local testing workflow. Vercel remains the production deployment target and does not require Docker for deployment.

Docker is used for:

- running the app consistently across machines
- testing the local backend with environment variables
- testing OpenAI calls through the backend
- testing Supabase Auth, Postgres, and Storage integration from local containers
- keeping the local environment reproducible

Recommended Docker files:

```txt
Dockerfile
docker-compose.yml
.dockerignore
```

Recommended container setup:

```txt
claimpilot-web
  Runs the React/Vite frontend.

claimpilot-api
  Runs the local backend API.
```

Recommended `docker-compose.yml` services:

```txt
services:
  web:
    build target for frontend
    exposes http://localhost:5173
    uses VITE_API_BASE_URL=http://localhost:3001

  api:
    build target for backend
    exposes http://localhost:3001
    uses OPENAI_API_KEY and Supabase environment variables
```

Recommended Docker behavior:

- Do not bake secrets into the Docker image.
- Load secrets from `.env`.
- Keep `.env` out of git.
- Use Supabase cloud directly during local testing.
- Do not run local Postgres unless the architecture changes later.
- Keep Vercel deployment independent from Docker.

Recommended `.dockerignore`:

```txt
node_modules
dist
.env
.env.*
.git
coverage
*.log
```

## Production Deployment

Production should include authorization before real claim functionality is available.

Unauthenticated users:

- can view dummy/demo pages
- can see sample capabilities
- cannot create real reports
- cannot upload real evidence
- cannot run authenticated OpenAI workflows

Authenticated users:

- can access the driver report list
- can create and edit reports
- can upload evidence
- can run OpenAI-powered analysis
- can export final PDF packets

Recommended production path:

- Vercel frontend and serverless API routes
- Supabase Auth for user authorization
- Supabase Postgres for reports
- Supabase Storage for evidence files
- server-side OpenAI API key stored in Vercel environment variables
- Supabase row-level security so users can access only their own reports

## OpenAI Integration

Use OpenAI for:

- rewriting messy driver notes into neutral factual summaries
- extracting structured details from free text
- suggesting follow-up questions
- identifying weak or contradictory claim details
- generating claim readiness explanations
- generating final packet summaries
- optionally analyzing uploaded damage photos in a later version

Keep deterministic readiness rules as a fallback so the app remains reliable if AI is unavailable.

## Deployment

- Local testing: Docker Compose running frontend and backend containers
- Demo deployment: Vercel public dummy pages plus locked authenticated app
- Production deployment: Vercel, Supabase, and server-side OpenAI calls

## Accounts and Setup Needed

To build and deploy ClaimPilot, the project needs:

- GitHub account or repository access
- Vercel account connected to the GitHub repo
- Supabase account and project
- OpenAI API Platform account and API key

Recommended setup order:

1. Create or confirm GitHub repository.
2. Create Vercel project from the repository.
3. Create Supabase project.
4. Create Supabase tables, storage bucket, and auth settings.
5. Create OpenAI API key.
6. Add environment variables to local `.env` and Vercel.
7. Set OpenAI usage limits before public testing.

GCP is not part of the selected deployment path.

## Non-Goals

Do not build:

- real insurance submission
- official Uber, Lyft, DoorDash, or insurer integrations
- claim approval prediction
- legal advice
- medical advice
- fault determination
- payment
- complex adjuster workflow
