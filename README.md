# ClaimPilot

ClaimPilot is a starter implementation scaffold for a rideshare and delivery driver claim preparation assistant.

## Project structure

- `frontend/` — Vite + React + TypeScript app
- `backend/` — Node + TypeScript API server
- `database/` — database schema and seed files
- `.github/agents/` — workspace agents for frontend, backend, and database work

## Getting started

1. Copy `.env.example` to `.env`
2. Update environment variables
3. Run `npm install`
4. Run `npm run dev:frontend` and `npm run dev:backend` or `npm run dev:all`

## Local development with Docker

Use `docker compose up --build` to start the frontend, backend, and local PostgreSQL service.

## Relevant env vars

See `.env.example` for the minimum required local variables.
