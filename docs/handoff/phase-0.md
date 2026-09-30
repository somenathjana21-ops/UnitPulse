# Handoff — Phase 0: Scaffold and Environment

**Written by:** Antigravity on 2026-09-30  
**Git tag:** `phase-0-complete` (pending commit)  
**Target:** Phase 1 — Schema, roles, and synthetic seed

## Summary (3 lines max)
Phase 0 monorepo scaffold initialized with npm workspaces for frontend (Next.js App Router), backend (server-only domain), and ml (deterministic analytics).
Cross-workspace imports resolve during Next.js production build (`npm run build`), all 17 workspace tests pass, and zero client-prefixed secrets exist.
Public explanation (`/`) and role portal (`/login`) pages render with required synthetic-demo and non-diagnosis safety statements.

## Files created / changed
- `package.json` — Root npm workspaces definition and lifecycle scripts (`dev`, `lint`, `test`, `test:e2e`, `build`, `seed:demo`)
- `.gitignore` — Protection for `*.env.local`, `.env`, keys, secrets, build artifacts, and debug logs
- `.env.example` — Server and client configuration template with explicit security warnings
- `TODO.md` — Phased roadmap of upcoming tasks across Phases 1 through 5 and release gates
- `frontend/package.json` — Next.js 14 App Router workspace importing `@unitpulse/backend` and `@unitpulse/ml`
- `frontend/src/app/layout.js` — Base layout with mandatory non-diagnosis safety statement and synthetic demo badge
- `frontend/src/app/page.js` — Public explanation page with 3 Core Principles and cross-workspace resolution proof
- `frontend/src/app/login/page.js` — Role portal sign-in demonstration showing Commander, Welfare Officer, and HR scopes
- `frontend/tests/imports.test.js` — Verifies Next.js environment resolves `@unitpulse/backend` and `@unitpulse/ml` exports
- `backend/src/` (`index.js`, `config.js`, `privacy.js`, `audit.js`, `welfare.js`, `todo.js`) — Server-only domain guards and privacy suppression rules
- `backend/tests/` (`config-audit.test.js`, `privacy.test.js`) — Unit tests for secret leak detection, grant validation, and suppression
- `ml/src/` (`index.js`, `scoring.js`, `baseline.js`, `triggers.js`, `noise.js`, `todo.js`) — Deterministic scoring, baselines, triggers, and Laplace noise
- `ml/tests/` (`scoring.test.js`, `baseline-triggers.test.js`) — Unit tests for index calculation, rolling baselines, and triggers
- `scripts/seed-demo.js` — Phase 0 placeholder explaining synthetic dataset specs and Phase 1 instructions
- `scripts/test-e2e.js` — Automated verification script checking workspaces, scripts, `.gitignore`, secret prefixes, and pages
- `tests/results/` — Actual command outputs and logs for build, lint, test, test:e2e, and seed:demo
- `docs/STATUS.md` — Updated with Phase 0 verified status, command logs, and tool readiness
- `docs/15-decision-log.md` — Added D-13 (workspace isolation) and D-14 (client secret prohibition)

## Commands run and results
| Command | Exit code | Notes |
|---|---|---|
| `npm run lint` | 0 | ESLint passed on frontend; secret checks passed on backend & ml |
| `npm run test` | 0 | 17 passed (2 frontend, 6 backend, 9 ml) |
| `npm run test:e2e` | 0 | 8/8 automated security and architectural checks passed |
| `npm run build` | 0 | Next.js 14 compiled and generated static pages (`/`, `/login`) |
| `npm run seed:demo` | 0 | Phase 0 placeholder validated execution and logged Phase 1 prerequisites |
| `npx supabase --version` | 0 | Supabase CLI v2.117.0 detected |
| `docker --version` | 1 | Command not found (Docker/Podman missing) |

## Exit-gate checklist (from Guidebook)
- [x] `npm install` succeeds from clean checkout
- [x] `npm run build` succeeds and resolves cross-workspace imports
- [x] `.env.local` is Git-ignored
- [x] Public page says **synthetic demo** and **not a diagnosis**
- [x] No hardcoded provider or Supabase service key appears in client code
- [x] No `NEXT_PUBLIC_` prefixes on service-role, AI, cron, or encryption secrets
- [x] Clear TODO list in `TODO.md` and UI for unfinished features

## Deviations from spec
None. All implementations conform to `Project_Brief.md`, `docs/02-prd.md`, `docs/05-system-architecture.md`, `docs/10-security-privacy.md`, and `docs/15-decision-log.md`.

## Traps for the next agent
1. **Missing Docker/Podman:** `npx supabase start` or `npx supabase db reset` will fail until Docker Desktop or Podman is installed and running on the host machine.
2. **Server-only boundary:** Do not import `backend/src/config.js` or any server-only secret handlers into client components (`"use client"`). All database and secret access must remain in Route Handlers or Server Components.
3. **No client secrets:** Never prefix `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `CRON_SECRET`, or encryption keys with `NEXT_PUBLIC_`.

## Exact next step
Run Phase 1 implementation prompt from `Guidebook.md` (Schema, roles, and synthetic seed). Before running local database migrations, ensure Docker or Podman is installed or configure a remote Supabase project.
