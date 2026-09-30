# STATUS — Unit Pulse 2.0

_Last updated: 2026-09-30 by Antigravity during Phase 1 pre-implementation handoff_

## Current phase
Phase 0 — Scaffold and environment  →  **COMPLETE / VERIFIED** (`phase-0-complete`)
Phase 1 — Schema, roles, synthetic seed  →  **PENDING IMPLEMENTATION**

## Phase completion table
| Phase | Implemented | Agent-verified | Manually verified | Tag |
|---|---|---|---|---|
| 0 | ✅ | ✅ | ✅ | `phase-0-complete` |
| 1 | ⬜ | ⬜ (NOT RUN) | ⬜ | |
| 2 | ⬜ | ⬜ | ⬜ | |

## What works right now
- `npm run lint` succeeds across all workspaces (`eslint` on frontend; custom zero-secret linters on backend and ml).
- `npm run test` succeeds with 17 passed tests (2 frontend import tests, 6 backend security/privacy tests, 9 ml deterministic scoring/baseline/trigger tests).
- `npm run test:e2e` passes 8/8 automated security and architectural assertions.
- `npm run build` succeeds (Next.js 14 App Router statically exports `/`, `/_not-found`, and `/login`).
- Monorepo npm workspaces (`frontend`, `backend`, `ml`) cleanly resolve cross-workspace imports during development and build.
- `npm run seed:demo` runs as a safe Phase 0 placeholder detailing target dataset parameters and Phase 1 database prerequisites.
- Public `/` and `/login` pages render with synthetic-demo disclaimer and mandatory "not a medical diagnosis" safety statement.
- Zero client-prefixed secrets: `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `CRON_SECRET`, and `APP_ENCRYPTION_KEY_BASE64` are strictly server-only.

## What does NOT work / not implemented yet
- Phase 1 Supabase SQL migrations not yet implemented (`supabase/migrations/` is currently empty).
- Phase 1 synthetic seed generator not yet implemented (`scripts/seed-demo.js` is a placeholder).
- Live Supabase Auth wiring; `/login` is UI only (scheduled for Phase 1).
- Local Supabase database cannot run because Docker/Podman is not installed on this system.
- Unit dashboard and report workflows (scheduled for Phases 3 and 4).
- AI adapter and briefing generation (scheduled for Phase 5).

## Known issues
- Docker Desktop or Podman is not installed on this host environment (`docker: command not found`). Local database commands (`npx supabase start`, `npx supabase db reset`, `npx supabase status`) fail until Docker or Podman is installed and running on PATH, or a remote hosted Supabase project is linked.

## Environment facts the next agent needs
- Node v20.20.2, npm 10.8.2, npm workspaces. Root `package.json` contains scripts.
- Supabase CLI v2.117.0 is installed via npx.
- `.env.example` is authoritative for variable names. Values are local only.
- Strict isolation: `@unitpulse/backend` is server-only domain logic; `@unitpulse/ml` is pure deterministic analytics.
- Real test results are logged in `tests/results/phase-1-2026-09-30.txt`.

## Decisions made this phase
- See `docs/15-decision-log.md` entries D-13 … D-14.

## Open questions for the human
- Confirm license choice before repo goes public.
- Confirm whether local development will use Docker Desktop/Podman or a remote hosted Supabase project for Phase 1 migrations.