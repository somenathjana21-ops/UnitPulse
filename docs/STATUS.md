# STATUS — Unit Pulse 2.0

_Last updated: 2026-09-30 by Claude Code during Phase 2 completion_

## Current phase
Phase 0 — Scaffold and environment  →  **COMPLETE / VERIFIED** (tag claimed `phase-0-complete`, NOT FOUND in repo — see note below)
Phase 1 — Schema, roles, synthetic seed  →  **COMPLETE / VERIFIED** (`phase-1-complete`)
Phase 2 — Metrics, index, baseline, and privacy release  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-2-complete`)
Phase 3 — Commander dashboard and walkthrough  →  **PENDING IMPLEMENTATION**

## Phase completion table
| Phase | Implemented | Agent-verified | Manually verified | Tag |
|---|---|---|---|---|
| 0 | ✅ | ✅ | ✅ | `phase-0-complete` — **tag missing from repo, unresolved** |
| 1 | ✅ | ✅ | ⬜ (Ready for review) | `phase-1-complete` |
| 2 | ✅ | ✅ | ⬜ (Ready for review) | `phase-2-complete` |
| 3 | ⬜ | ⬜ (NOT RUN) | ⬜ | |

## What works right now
- `npm run lint` succeeds across all workspaces (`eslint` on frontend; custom zero-secret linters on backend and ml, now covering 9 backend files).
- `npm run test` succeeds with **64 passed tests** (was 51 at end of Phase 1):
  - 2 frontend workspace import and wiring tests.
  - 53 backend tests: Phase 1 schema/RLS static audit, access control simulations, 9 hostile penetration scenarios, privacy suppression, welfare lifecycle transitions, **plus 13 new Phase 2 tests** for `metrics.js` (leave utilization, recovery gap, denial rate, 28d/7d window boundaries, deployment continuity, coverage exclusion) and `release.js` (small-group suppression, small-cell/breakout suppression, insufficient-coverage handling, idempotent re-fetch, baseline boundary, triggered-unit deduplication).
  - 9 ml tests (deterministic scoring, rolling baseline, trigger evaluation, normalization) — unchanged from Phase 1; already covered the Phase 2 spec.
- `npm run test:e2e` passes **13/13** (was 11/11): added a static check that `backend/src/metrics.js`/`release.js` exist and are exported, and a functional smoke test that runs the release pipeline end-to-end (small-group suppression + idempotent repeat call).
- `npm run build` succeeds (Next.js 14 App Router statically exports `/`, `/_not-found`, and `/login`; Phase 2 added no frontend routes).
- New: `backend/src/metrics.js` — computes weekly verified-source metrics (leave utilization/90d, recovery gap >60d, denial rate, night-duty/28d, workload/7d, deployment continuity) from raw `personnel`/`leave_eligibility`/`leave_records`/`duty_records`/`deployments` shaped rows. Never zero-fills a missing/unverified record; per-domain coverage ratio (hr/leave/duty/deployment) determines the 80% sufficiency gate.
- New: `backend/src/release.js` — the private-to-public release job: `computeWeeklySourceMetrics` → `ml.calculateUnitStrainIndex` → `ml.calculateBaseline` → `ml.evaluateTriggers` → `checkGroupSuppression`/`checkCellSuppression` → `applyPersistentBoundedNoise`, producing a `privateMetrics` row and a `publicRelease` row. Pass a previously returned release back in as `existingRelease` for exact idempotent reuse — noise is never resampled.
  - `deriveReleaseBand()` independently maps index→`normal`/`elevated`/`high` for the public DB vocabulary (see D-18 — do not use `ml/scoring.js`'s internal `band` field for this).
  - Small-cell suppression is applied to two bounded person-counts (`approxDeployedPersonnelCount`, `approxRecoveryGapExceededCount`); either is silently omitted from `approved_metrics_json` when it or its complement would be <5.

## What does NOT work / not implemented yet
- Live local PostgreSQL container execution via `npx supabase db reset` is **NOT RUN** because Docker Desktop/Podman is not installed on this Windows host. `backend/src/metrics.js` and `release.js` are pure functions tested against in-memory fixtures, never against a live Supabase instance or the actual `supabase/seed.sql` data.
- The release pipeline is not wired to any actual data source yet — no code reads from `private.*` tables or writes to `private.unit_week_metrics` / `public.unit_week_releases`. That wiring (a route or worker calling `runWeeklyRelease` with real query results) is Phase 4's `backend/src/worker.js` + Vercel cron route, per TODO.md.
- `scripts/seed-demo.js` still synthesizes `unitWeekMetrics`/`unitWeekReleases` numbers directly rather than deriving them via the new `metrics.js`/`release.js` pipeline. Left untouched deliberately — Phase 1 is tagged/verified and reseeding wasn't in Phase 2's scope; flagging as a known gap between the demo seed and the real pipeline (see Traps in `docs/handoff/phase-2.md`).
- Unit dashboard UI (`/commander` and `/commander/units/[id]`, scheduled for Phase 3).
- Welfare inbox and report detail UI (`/welfare`, scheduled for Phase 4).
- AI adapter and briefing generation (scheduled for Phase 5).

## Known issues
- Docker Desktop or Podman is not installed on this host environment (`docker: command not found`). Local database commands (`npx supabase start`, `npx supabase db reset`, `npx supabase status`) fail until Docker or Podman is installed and running on PATH, or a remote hosted Supabase project is linked via `npx supabase link`.
- The `phase-0-complete` git tag referenced in this file does not exist in the repository (found during the 2026-09-30 verification session, still unresolved).

## Environment facts the next agent needs
- This host: Node v24.19.0, npm 11.17.0 (differs from the v20.20.2/10.8.2 recorded at end of Phase 1 — tests/build pass regardless). npm workspaces. Root `package.json` contains `"type": "module"`.
- `npx supabase --version` currently resolves 2.118.0 (npx always fetches latest unless pinned; not pinned in this repo).
- SQL migration located at `supabase/migrations/20260930120000_phase1_initial_schema.sql` (unchanged in Phase 2).
- SQL seed file located at `supabase/seed.sql` (unchanged in Phase 2 — see gap noted above).
- Real test results are logged in `tests/results/phase-1-2026-09-30.txt` and `tests/results/phase-2-2026-09-30.txt`.

## Decisions made this phase
- See `docs/15-decision-log.md` entries D-18 (public release band computed independently of `ml/scoring.js`'s internal band vocabulary) and D-19 (per-domain coverage semantics; verified non-deployed counts as a confirmed zero).
- `scripts/test-e2e.js`'s `check()` helper was fixed to actually `await` async check functions — it silently always passed async checks before (their resolved value was never inspected). Not a spec/code disagreement, a pre-existing script bug caught while adding Phase 2 checks.

## Open questions for the human
- Confirm whether local testing will use Docker Desktop/Podman or a remote hosted Supabase project for executing `npx supabase db reset` — this still blocks ever validating the Phase 1 migration and the Phase 2 pipeline against a real Postgres instance.
- Should `scripts/seed-demo.js` be rewritten to derive `unitWeekMetrics`/`unitWeekReleases` from raw records via the new `backend/src/metrics.js` + `release.js` pipeline instead of synthesizing them directly? Not done in Phase 2 to avoid touching an already-tagged, verified Phase 1 deliverable without explicit sign-off.
- Resolve the missing `phase-0-complete` git tag (create it now, or correct the historical record).
