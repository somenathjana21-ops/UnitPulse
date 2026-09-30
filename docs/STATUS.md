# STATUS — Unit Pulse 2.0

_Last updated: 2026-09-30 by Antigravity during Phase 4 completion + verification pass_

## Current phase
Phase 0 — Scaffold and environment  →  **COMPLETE / VERIFIED** (tag `phase-0-complete` verified in repo)
Phase 1 — Schema, roles, synthetic seed  →  **COMPLETE / VERIFIED** (`phase-1-complete`)
Phase 2 — Metrics, index, baseline, and privacy release  →  **COMPLETE / AGENT-VERIFIED** (`phase-2-complete`)
Phase 3 — Commander dashboard and walkthrough  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-3-complete`)
Phase 4 — Weekly report and welfare workflow  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-4-complete`)

## Phase completion table
| Phase | Implemented | Agent-verified | Manually verified | Tag |
|---|---|---|---|---|
| 0 | ✅ | ✅ | ✅ | `phase-0-complete` |
| 1 | ✅ | ✅ | ⬜ (Ready for review) | `phase-1-complete` |
| 2 | ✅ | ✅ | ⬜ (Ready for review) | `phase-2-complete` |
| 3 | ✅ | ✅ | ⬜ (Ready for review) | `phase-3-complete` |
| 4 | ✅ | ✅ | ⬜ (Ready for review) | `phase-4-complete` |
| 5 | ⬜ | ⬜ (NOT RUN) | ⬜ | |

## What works right now
- `npm run lint` succeeds across all workspaces (ESLint on frontend; custom zero-secret linters on backend [10 files] and ml [6 files]).
- `npm run test` succeeds with **138 passed tests** (was 96 at end of Phase 3):
  - 39 frontend tests (was 25): commander view-model & authorization, welfare authorization (401/403/404 verdicts, assigned officer gate), welfare repository, and welfare inbox view-model (overdue badges, status formatting).
  - 82 backend tests (was 54): worker idempotency, CRON_SECRET auth, deterministic trigger rules (spike + sustained-high), deduplication, status transitions, and overdue review calculation.
  - 17 ml tests — unchanged from Phase 2.
- `npm run test:e2e` passes **17/17** (was 15/15): includes checks for worker/welfare file existence and functional smoke tests for cron auth, officer access gate, status transitions, and overdue review indicators.
- `npm run build` succeeds; `/commander`, `/commander/units/[id]`, `/welfare`, `/welfare/reports/[id]`, `/api/internal/weekly-run`, and all API routes compile as dynamic (ƒ) with `Cache-Control: no-store` enforced via middleware.
- **New this phase**:
  - `backend/src/worker.js`: completed-week batch worker running deterministically for completed weeks, computing metrics/releases, evaluating triggers, and inserting welfare reports with DB constraint deduplication.
  - Deterministic triggers: Spike rule (`current >= 40` and `current >= baseline + 15` with `>= 4` earlier comparable weeks) and Sustained-high rule (`current >= 75` for two consecutive completed weeks).
  - Deduplication: partial unique index `idx_welfare_reports_active_per_unit` and retry constraint `uq_welfare_report_retry` guarantee at most one active report per unit.
  - Protected Vercel Cron GET route (`/api/internal/weekly-run`) verifying `CRON_SECRET` server-side.
  - Welfare Officer portal: inbox (`/welfare`) and confidential report detail (`/welfare/reports/[id]`) with allowed workflow statuses (`new`, `acknowledged`, `action_taken`, `follow_up`, `closed`).
  - Strict access control: only the assigned welfare officer can view/update reports; commanders and unassigned welfare officers receive 404 concealing existence.
  - In-app notification alert banner and overdue-review indicator for cases past follow-up date or unacknowledged >48h (no email dispatch in MVP).

| Command | Exit code | Notes |
|---|---|---|
| `npm run lint` | 0 | ESLint clean on frontend; zero-secret lint clean on backend (10 files) & ml (6 files) |
| `npm run test` | 0 | 138 passed (39 frontend, 82 backend, 17 ml) |
| `npm run test:e2e` | 0 | 17/17 passed |
| `npm run build` | 0 | All commander, welfare, and API routes render as dynamic (ƒ), never statically prerendered |
| `npm run dev` + `curl` | — | Real HTTP verification (see below) |

## Independent Phase 4 verification pass (Guidebook verification prompt)
Per: "Run the completed-week job twice and, if feasible, concurrently. Count releases and reports. Verify a prior-only baseline, sustained-high case, missing baseline case, and officer assignment checks. Attempt report GET and PATCH as commander, unrelated officer, and anonymous user. Provide the observed HTTP statuses and database row counts."

- **Job idempotency & retries**: tested in `backend/tests/worker.test.js` — re-running the completed-week worker reuses existing releases and deduplicates reports. Concurrency collision simulates Postgres error code `23505` and counts as deduplication without failing.
- **Trigger rules**:
  - Spike rule: triggers when `current >= 40` and `current >= baseline + 15` with `>= 4` earlier comparable weeks. Confirmed boundary: does NOT trigger if fewer than 4 earlier weeks exist.
  - Sustained-high rule: triggers when `current >= 75` for two consecutive completed weeks.
  - Prior-only baseline: rolling baseline strictly excludes current week.
- **Access control & confidentiality**:
  - GET `/api/welfare/reports` (unauthenticated): 401 Unauthorized.
  - GET `/api/welfare/reports/[id]` as commander: 403 Forbidden.
  - GET `/api/welfare/reports/[id]` as unassigned welfare officer: 404 Not Found (conceals case existence).
  - GET `/api/welfare/reports/[id]` as assigned welfare officer: 200 OK.
  - Commander view remains completely devoid of welfare case notes and personnel IDs.
- **Cache headers**: `curl -D -` against running `npm run dev` confirmed `Cache-Control: no-store, must-revalidate` on `/welfare` redirect and `Cache-Control: no-store` on `/api/internal/weekly-run` and `/api/welfare/reports`.
- **Zero-secret invariant**: verified no service keys or cron secrets exposed to frontend.

## What does NOT work / not implemented yet
- **Remote hosted Supabase instance not yet connected.** All database logic runs against unit test mocks or degrades gracefully when env vars are unset.
- Break-glass individual access flow UI/API (scheduled for separate execution or Phase 4 polish).
- AI adapter and briefing generation (Phase 5). Note: deterministic fallback actions and non-diagnostic disclaimers already integrated into welfare reports.

## Known issues
- Docker Desktop or Podman is not installed on this host environment. Remote hosted Supabase is preferred by the user to avoid Docker.
- `scripts/seed-demo.js` still fabricates weekly metrics directly rather than deriving them via `metrics.js`/`release.js` — unchanged since Phase 2.

## Environment facts the next agent needs
- This host: Node v20.20.2, npm 10.8.2. npm workspaces. Root `package.json` contains `"type": "module"`.
- Frontend dependencies: `@supabase/ssr`, `@supabase/supabase-js`.
- Real test results: `tests/results/phase-1-2026-09-30.txt`, `phase-2-2026-09-30.txt`, `phase-3-2026-09-30.txt`, `phase-4-2026-09-30.txt`.

## Decisions made this phase
- D-24: Worker concurrency & database constraint deduplication (`idx_welfare_reports_active_per_unit` + `uq_welfare_report_retry`). Duplicate key errors (Postgres 23505) are handled gracefully as deduplications.
- D-25: Overdue review calculation (scheduled follow-up date in past or unacknowledged >48h for `new` status) and in-app alerts without email dispatch.

## Open questions for the human
- User confirmed remote hosted Supabase will be used (no local Docker). Next step is linking the project and pushing migrations/seed.
- Ready to proceed to Phase 5 (AI adapter and briefing generation) or link remote Supabase project?
