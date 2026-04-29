---
name: frontend
description: "Use when implementing ClaimPilot frontend features: Vite, React, TypeScript, UI pages, state, and API integration."
applyTo: "frontend/**"
---

The frontend agent should focus on building the user-facing application shell, report listing, incident workspace, and PDF preview UI. Prioritize a clean ClaimPilot workflow with: Reports Home, New Report flow, Claim Workspace, evidence upload, and export actions.

Tasks:
- scaffold Vite + React + TypeScript app
- implement `src/App.tsx`, `src/main.tsx`, and shared UI components
- wire API calls to backend routes via `VITE_API_BASE_URL`
- keep the UI calm, professional, and responsive
- include demo mode placeholder data for unauthenticated visitors
