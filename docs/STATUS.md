# STATUS — Unit Pulse 2.0

_Last updated: 2026-09-30 by Claude Code during Phase 2 completion + verification pass_

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
- `npm run lint` succeeds across all workspaces (ESLint on frontend; custom zero-secret linters on backend [9 files] and ml [7 files]).
- `npm run test` succeeds with **73 passed tests** (was 51 at end of Phase 1):
  - 2 frontend workspace import/wiring tests.
  - 54 backend tests: Phase 1 schema/RLS static audit, access control simulations, 9 hostile penetration scenarios, welfare lifecycle transitions, privacy suppression, **plus 14 Phase 2 tests** for `metrics.js` (leave utilization, recovery gap, denial rate, 28d/7d window boundaries, deployment continuity, zero-denominator handling, coverage exclusion) and `release.js` (small-group suppression, small-cell/breakout suppression, insufficient-coverage handling, idempotent re-fetch, baseline boundary, triggered-unit deduplication).
  - 17 ml tests: the 9 Phase-1-era deterministic scoring/baseline/trigger tests, **plus 8 new boundary-audit tests** added during Phase 2's independent verification pass (every `>` threshold in docs/07's scoring table checked exactly at and one unit above the boundary; empty-metrics-object never throws).
- `npm run test:e2e` passes **13/13** (was 11/11): a static check that `backend/src/metrics.js`/`release.js` exist and are exported, and a functional smoke test that runs the release pipeline end-to-end (small-group suppression + idempotent repeat call).
- `npm run build` succeeds (Next.js 14 App Router statically exports `/`, `/_not-found`, and `/login`; Phase 2 added no frontend routes).
- `backend/src/metrics.js` — computes weekly verified-source metrics (leave utilization/90d, recovery gap >60d, denial rate, night-duty/28d, workload/7d, deployment continuity) from raw `personnel`/`leave_eligibility`/`leave_records`/`duty_records`/`deployments` shaped rows. Never zero-fills a missing/unverified record; per-domain coverage ratio (hr/leave/duty/deployment) gates the 80% sufficiency threshold.
- `backend/src/release.js` — the private-to-public release job: `computeWeeklySourceMetrics` → `ml.calculateUnitStrainIndex` → `ml.calculateBaseline` (prior-weeks-only, confirmed structurally: it only ever sees whatever `priorWeeksHistory` the caller passes, never the week being computed) → `ml.evaluateTriggers` → `checkGroupSuppression`/`checkCellSuppression` → `applyPersistentBoundedNoise`, producing a `privateMetrics` row and a `publicRelease` row. Pass a previously returned release back in as `existingRelease` for exact idempotent reuse — noise is never resampled.
  - `deriveReleaseBand()` independently maps index→`normal`/`elevated`/`high` for the public DB vocabulary (D-18 — do not use `ml/scoring.js`'s internal `band` field for this).
  - Small-cell suppression covers two bounded person-counts (`approxDeployedPersonnelCount`, `approxRecoveryGapExceededCount`); either is silently *omitted as a key* (not nulled) from `approved_metrics_json` when it or its complement would be <5 — verified this holds even if a future route naively serializes the whole object.

## Independent Phase 2 verification pass (Guidebook verification prompt, run this session)
Per docs/07's scoring table, every rule is a strict `>` threshold. Added `ml/tests/scoring-boundaries.test.js` (8 tests) asserting the value exactly at each threshold scores the lower tier, and one unit above scores the higher tier, for: days-since-leave (60), recovery gap (35%), denial rate (25%, plus the 5-decided-request cutoff), night-duty (5/8/12), deployment (60/90), workload (52/60), and the 80% coverage-ratio cutoff. All passed on first correct assertion (one test's own expected value was wrong on the first run and was fixed, not the implementation). Also added a metrics.js test confirming a zero leave-eligibility denominator returns `null` ("unavailable"), never a computed 0, and confirmed by code review that `checkGroupSuppression`/`checkCellSuppression` fire before any noised value is computed (never computed-then-hidden).

Reviewed for hidden-exact-metric leakage: `runWeeklyRelease()` returns both `privateMetrics` (exact) and `publicRelease` (suppressed/noised) in one object. No code path today serializes this to an API response (no Phase 3+ route exists yet), but nothing currently prevents a future route from returning the whole object by mistake. Added a JSDoc warning in `release.js` (D-20) rather than a structural fix, since no real caller exists yet to shape a stricter contract against.

Formal-privacy claim this implementation cannot support (unchanged from docs/10's own "Important limitation," re-confirmed, not new): a minimum group size of 5 is not a proof of k-anonymity, and per-count Laplace noise does not make the system differentially private. Repeated overlapping weekly releases, band changes, and operational context can still leak information. Nothing in Phase 2 claims otherwise.

## What does NOT work / not implemented yet
- Live local PostgreSQL container execution via `npx supabase db reset` is **NOT RUN** because Docker Desktop/Podman is not installed on this Windows host. `backend/src/metrics.js` and `release.js` are pure functions tested against in-memory fixtures only, never against a live Supabase instance or the actual `supabase/seed.sql` data.
- The release pipeline is not wired to any actual data source yet — no code reads from `private.*` tables or writes to `private.unit_week_metrics` / `public.unit_week_releases`. That wiring (a route or worker calling `runWeeklyRelease` with real query results) is Phase 4's `backend/src/worker.js` + Vercel cron route, per TODO.md.
- `scripts/seed-demo.js` still synthesizes `unitWeekMetrics`/`unitWeekReleases` numbers directly rather than deriving them via the new `metrics.js`/`release.js` pipeline. Left untouched deliberately — Phase 1 is tagged/verified and reseeding wasn't in Phase 2's scope. Open question below.
- Unit dashboard UI (`/commander` and `/commander/units/[id]`, scheduled for Phase 3).
- Welfare inbox and report detail UI (`/welfare`, scheduled for Phase 4).
- AI adapter and briefing generation (scheduled for Phase 5).

## Known issues
- Docker Desktop or Podman is not installed on this host environment (`docker: command not found`). Local database commands (`npx supabase start`, `npx supabase db reset`, `npx supabase status`) fail until Docker or Podman is installed and running on PATH, or a remote hosted Supabase project is linked via `npx supabase link`.
- The `phase-0-complete` git tag referenced in this file does not exist in the repository (found during an earlier verification session, still unresolved).
- `runWeeklyRelease()`'s return shape mixes private and public data in one object; currently guarded only by a code comment (D-20), not a type or schema. Low risk today (nothing calls it from a route), but a real risk once Phase 3/4 add API routes — track this until a route exists and can be checked against it.

## Environment facts the next agent needs
- This host: Node v24.19.0, npm 11.17.0 (differs from the v20.20.2/10.8.2 recorded at end of Phase 1 — tests/build pass regardless). npm workspaces. Root `package.json` contains `"type": "module"`.
- `npx supabase --version` currently resolves 2.118.0 (npx always fetches latest unless pinned; not pinned in this repo).
- SQL migration located at `supabase/migrations/20260930120000_phase1_initial_schema.sql` (unchanged in Phase 2).
- SQL seed file located at `supabase/seed.sql` (unchanged in Phase 2 — see gap noted above).
- Real test results are logged in `tests/results/phase-1-2026-09-30.txt` and `tests/results/phase-2-2026-09-30.txt` (the latter includes this session's verification-pass additions).
- AGENTS.md and CLAUDE.md were re-checked this session against the current codebase: both still accurate, no root npm scripts changed, no updates needed.

## Decisions made this phase
- D-18: public release band computed independently of `ml/scoring.js`'s internal band vocabulary (`deriveReleaseBand()`).
- D-19: per-domain coverage semantics in `metrics.js`; verified non-deployed counts as a confirmed zero, not missing data.
- D-20: `runWeeklyRelease()`'s mixed private/public return shape is guarded by a doc comment only, pending a real API route to design a stricter contract against.
- `scripts/test-e2e.js`'s `check()` helper was fixed to actually `await` async check functions — it silently always passed async checks before (their resolved value was never inspected). Pre-existing script bug caught while adding Phase 2 checks, not a spec/code disagreement.

## Open questions for the human
- Confirm whether local testing will use Docker Desktop/Podman or a remote hosted Supabase project for executing `npx supabase db reset` — this still blocks ever validating the Phase 1 migration and the Phase 2 pipeline against a real Postgres instance.
- Should `scripts/seed-demo.js` be rewritten to derive `unitWeekMetrics`/`unitWeekReleases` from raw records via the new `backend/src/metrics.js` + `release.js` pipeline instead of synthesizing them directly? Not done in Phase 2 to avoid touching an already-tagged, verified Phase 1 deliverable without explicit sign-off.
- Resolve the missing `phase-0-complete` git tag (create it now, or correct the historical record).
