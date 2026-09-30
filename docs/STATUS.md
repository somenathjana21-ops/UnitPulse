# STATUS — Unit Pulse 2.0

_Last updated: 2026-09-30 by Antigravity during Phase 1 completion_

## Current phase
Phase 0 — Scaffold and environment  →  **COMPLETE / VERIFIED** (`phase-0-complete`)
Phase 1 — Schema, roles, synthetic seed  →  **COMPLETE / VERIFIED** (`phase-1-complete`)
Phase 2 — Metrics, index, baseline, and privacy release  →  **PENDING IMPLEMENTATION**

## Phase completion table
| Phase | Implemented | Agent-verified | Manually verified | Tag |
|---|---|---|---|---|
| 0 | ✅ | ✅ | ✅ | `phase-0-complete` |
| 1 | ✅ | ✅ | ⬜ (Ready for review) | `phase-1-complete` |
| 2 | ⬜ | ⬜ (NOT RUN) | ⬜ | |

## What works right now
- `npm run lint` succeeds across all workspaces (`eslint` on frontend; custom zero-secret linters on backend and ml).
- `npm run test` succeeds with 42 passed tests:
  - 2 frontend workspace import and wiring tests.
  - 31 backend tests (schema/RLS static audit, access control simulations, anonymous/commander permission boundaries, privacy suppression, and welfare lifecycle transitions).
  - 9 ml tests (deterministic scoring, rolling baseline, trigger evaluation, and normalization).
- `npm run test:e2e` passes 11/11 automated security, architectural, and Phase 1 migration/seed assertions.
- `npm run build` succeeds (Next.js 14 App Router statically exports `/`, `/_not-found`, and `/login`).
- `supabase/migrations/20260930120000_phase1_initial_schema.sql` establishes:
  - `private` schema with permissions explicitly revoked from `public`, `anon`, and `authenticated`.
  - Raw operational source tables strictly in `private`: `units`, `personnel`, `leave_eligibility`, `leave_records`, `duty_records`, `deployments`, `unit_week_metrics`, `access_grants`, `access_audit`.
  - Client-facing tables in `public` with RLS enabled on every table: `user_roles`, `unit_assignments`, `unit_week_releases`, `welfare_reports`.
  - Partial unique index `idx_welfare_reports_active_per_unit` enforcing at most one active welfare report per unit.
  - Narrow role-provisioning security definer procedure `public.provision_user_role` restricted to `service_role`.
  - Transactional break-glass read function `private.execute_audited_break_glass_read` restricted to `service_role`.
  - Zero RLS on materialized views.
- `scripts/seed-demo.js` generates:
  - 6 fictional units (`UNIT-A` through `UNIT-F`).
  - 60 synthetic personnel each (360 total) with pseudonymous IDs only (`PER-X-###`).
  - ~180 days of daily duty records (65,160 entries), leave records (510 entries), and deployments (130 entries).
  - 12 completed usable weekly snapshots (plus 14 warm-up weeks).
  - 1 elevated unit (`UNIT-B`: sustained-high index = 75, band = `high`, triggering 1 confidential welfare report).
  - 1 stable unit (`UNIT-A`: index = 0, band = `normal`, 0 reports).
  - Outputs complete idempotent SQL script to `supabase/seed.sql` (2.9 MB).

## What does NOT work / not implemented yet
- Live local PostgreSQL container execution via `npx supabase db reset` is **NOT RUN** because Docker Desktop/Podman is not installed on this Windows host.
- Unit dashboard UI (`/commander` and `/commander/units/[id]`, scheduled for Phase 3).
- Welfare inbox and report detail UI (`/welfare`, scheduled for Phase 4).
- AI adapter and briefing generation (scheduled for Phase 5).

## Known issues
- Docker Desktop or Podman is not installed on this host environment (`docker: command not found`). Local database commands (`npx supabase start`, `npx supabase db reset`, `npx supabase status`) fail until Docker or Podman is installed and running on PATH, or a remote hosted Supabase project is linked via `npx supabase link`.

## Environment facts the next agent needs
- Node v20.20.2, npm 10.8.2, npm workspaces. Root `package.json` contains `"type": "module"`.
- Supabase CLI v2.117.0 is installed via npx.
- SQL migration located at `supabase/migrations/20260930120000_phase1_initial_schema.sql`.
- SQL seed file located at `supabase/seed.sql`.
- Real test results are logged in `tests/results/phase-1-2026-09-30.txt`.

## Decisions made this phase
- See `docs/15-decision-log.md` entries D-15 (schema boundary), D-16 (materialized view constraint), and D-17 (narrow role provisioning & break-glass functions).

## Open questions for the human
- Confirm whether local testing will use Docker Desktop/Podman or a remote hosted Supabase project for executing `npx supabase db reset`.