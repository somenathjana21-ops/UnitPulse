# Handoff — Phase 2: Metrics, Index, Baseline, and Privacy Release

**Written by:** Claude Code on 2026-09-30
**Git tag:** `phase-2-complete`  **Last commit:** see `git log -1` at tag time
**Status:** Phase 2 Complete and Agent-Verified. Manual/human verification still pending.

## Summary (3 lines max)
Implemented `backend/src/metrics.js` (raw records → weekly verified-source metrics, exact windows, no zero-filling) and `backend/src/release.js` (the private→public release job: score → baseline → trigger → suppression → noise → release row), wired into `@unitpulse/backend`'s public exports.
The pure scoring/baseline/trigger/noise functions in `ml/` and the suppression checks in `backend/src/privacy.js` already existed from Phase 1 and needed no changes; Phase 2's job was the metric aggregation layer and the orchestration that ties them together.
64 unit tests (up from 51) and 13/13 e2e checks (up from 11/11) pass; lint and build are clean.

## Files created / changed
- `backend/src/metrics.js` — new. Computes leave utilization (90d), recovery gap (>60d), leave denial rate, night-duty load (28d), weekly workload (7d), and deployment continuity from raw `personnel`/`leave_eligibility`/`leave_records`/`duty_records`/`deployments` rows, plus per-domain coverage ratios.
- `backend/src/release.js` — new. `runWeeklyRelease()` orchestrates metrics → `@unitpulse/ml` scoring/baseline/triggers → `checkGroupSuppression`/`checkCellSuppression` → `applyPersistentBoundedNoise`, and `deriveReleaseBand()` maps the index to the public DB band vocabulary.
- `backend/src/index.js` — added `export * from './metrics.js'` and `'./release.js'`.
- `backend/package.json` — added `./metrics` and `./release` subpath exports.
- `backend/tests/metrics.test.js` — new, 6 tests.
- `backend/tests/release.test.js` — new, 7 tests (includes all fixtures the Guidebook's Phase 2 prompt asked for).
- `scripts/test-e2e.js` — added 2 Phase 2 checks (module-export check, functional suppression/idempotency smoke test); fixed the `check()` helper to actually `await` async checks (previously always passed them without inspecting the resolved value — a pre-existing bug, not new in this phase).
- `docs/STATUS.md` — Phase 2 marked complete/agent-verified; documented what's still not wired up.
- `docs/15-decision-log.md` — added D-18 (public release band is independent of `ml/scoring.js`'s internal band field) and D-19 (per-domain coverage semantics, verified-non-deployed = confirmed zero).
- `TODO.md` — Phase 2 checklist marked complete.
- `tests/results/phase-2-2026-09-30.txt` — real captured output of lint/test/test:e2e/build.

## Commands run and results
| Command | Exit code | Notes |
|---|---|---|
| `npm run lint` | 0 | ESLint clean on frontend; zero-secret lint clean on backend (9 files) & ml |
| `npm run test` | 0 | 64 passed (2 frontend, 53 backend, 9 ml) |
| `npm run test:e2e` | 0 | 13/13 (11 Phase 0/1 checks + 2 new Phase 2 checks) |
| `npm run build` | 0 | Next.js 14 production build compiled successfully |

## Exit-gate checklist (from Guidebook)
- [x] A four-person unit shows no hidden figures — `release.test.js`: group-of-4 fixture asserts `approved_metrics_json` is `{}` and `index_approx`/`band` are `null`.
- [x] A revealing one-person breakout remains hidden even in a larger unit — `release.test.js`: group-of-5-with-1-deployed fixture asserts the unit still publishes (index/band present) while `approxDeployedPersonnelCount` is absent.
- [x] Reloading the same weekly view returns the same approximate numbers — `release.test.js`: calling `runWeeklyRelease` a second time with `existingRelease` set returns the identical `publicRelease` object, no resampling.
- [x] Missing records show "insufficient data," never "0 risk" — `release.test.js`/`metrics.test.js`: incomplete duty coverage yields `suppression_status: 'insufficient_coverage'`, `band: 'insufficient_data'`, `index_approx: null` — never a computed 0.
- [x] Index and baseline come from code, not the LLM — no AI code exists yet (Phase 5); `release.js` calls only `@unitpulse/ml` deterministic functions.

## Deviations from spec
None against docs/06, docs/07, docs/10. One internal-code inconsistency found and resolved without touching either existing spec: `ml/src/scoring.js`'s `band` field (`Normal`/`Review`/`Elevated`) uses a different vocabulary than the DB's `unit_week_releases.band` check constraint (`normal`/`elevated`/`high`/`insufficient_data`). `scripts/seed-demo.js` had already worked around this by computing its own band string inline instead of using `scoreResult.band`. `release.js` now does the same explicitly via `deriveReleaseBand()`, documented as D-18. `scoring.js` itself was not touched — its `band` field is asserted by existing Phase 1 tests and remains an internal/debug value only.

## Traps for the next agent
1. **The release pipeline is not connected to real data anywhere.** `runWeeklyRelease()` and `computeWeeklySourceMetrics()` are pure functions tested only against small in-memory fixtures. Nothing in this repo calls them with query results from Supabase, and nothing writes their output to `private.unit_week_metrics` / `public.unit_week_releases`. That wiring belongs to Phase 4's `backend/src/worker.js` + `/api/internal/weekly-run` cron route per TODO.md — don't assume the release job is "live" anywhere yet.
2. **`scripts/seed-demo.js` still fabricates weekly metrics directly** (hardcoded `meanDaysSinceLeave`, `recoveryGapPercent`, etc. per unit profile) instead of deriving them from the raw duty/leave/deployment rows it also generates. This means `supabase/seed.sql`'s `unit_week_metrics`/`unit_week_releases` rows will NOT exactly match what `metrics.js`/`release.js` would compute from that same seed's raw tables if you ran the new pipeline over it. Left alone deliberately (Phase 1 is tagged and verified; reseeding wasn't asked for). If Phase 3/4 dashboards need release rows that are actually consistent with the pipeline, someone needs to decide whether to regenerate `seed.sql` via the real pipeline — flagged as an open question in STATUS.md.
3. **Docker/Podman still isn't installed.** Everything here was verified with plain `node --test`, never against a live Postgres. If Phase 4's cron worker needs integration tests against real `private.*` tables, that gap will surface then.
4. **Small-cell suppression only covers two specific counts** (`deployedPersonnelCount`, `recoveryGapExceededCount`) in `buildApprovedMetrics()`. If a future phase adds more bounded person-count fields to the public release, each one needs its own `checkCellSuppression` + `applyPersistentBoundedNoise` treatment — it isn't automatic.
5. **`deriveReleaseBand()` vs. `scoreResult.band`:** don't "simplify" `release.js` by swapping in `scoreResult.band` — it will fail the DB check constraint on `unit_week_releases.band`. See D-18.

## Exact next step
"Run Phase 3 implementation prompt from Guidebook.md (Commander dashboard and walkthrough) in `frontend/src/app/commander/`. Before that, decide whether `scripts/seed-demo.js` needs to be rewritten against the real `metrics.js`/`release.js` pipeline so the dashboard's demo data is actually consistent with Phase 2's logic — see the open question in `docs/STATUS.md`."
