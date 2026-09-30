# 15 — Decision Log

Record changes here when implementation differs from the approved design.

| ID | Decision | Why | Status / revisit |
|---|---|---|---|
| D-01 | Name the measure “Unit Load & Recovery Index,” not “stress score” | HR records reflect conditions, not a diagnosis | Accepted for MVP |
| D-02 | Default commander access is aggregate only | Prevent stigmatization and unnecessary disclosure | Accepted |
| D-03 | Use private raw tables and RLS-protected release tables | PostgreSQL materialized views are not an RLS boundary | Accepted |
| D-04 | Compute index/triggers with deterministic code | Auditability and reliable reproduction | Accepted; validate thresholds later |
| D-05 | Use an LLM only for constrained explanations | Provider output is not reliable enough for core decisions | Accepted |
| D-06 | Publish completed weekly periods | Avoid rapid changes and reduce inference risk | Accepted; review with sponsor |
| D-07 | Suppress groups under five and small cells | MVP privacy safeguard, not formal anonymity | Accepted; assess higher threshold later |
| D-08 | Sample bounded count noise once per release | Repeated page views must not reveal different values | Accepted; review privacy budget later |
| D-09 | Audit individual reads through a transactional function | Grant-based RLS alone does not log every SELECT | Accepted |
| D-10 | Public demo uses synthetic data only | Real force data requires separate approvals and infrastructure | Accepted |
| D-11 | Print-to-PDF is the MVP export | Avoid claiming an unimplemented PDF generation service | Accepted; revisit if needed |
| D-12 | No clinical ML training in MVP | No validated, ethically collected training labels | Accepted; future research only |
| D-13 | Use npm workspaces for frontend, backend, and ml isolation | Strict trust boundary separation between server-only domain, pure ML, and UI | Accepted |
| D-14 | Forbid NEXT_PUBLIC_ on service, AI, cron, and encryption secrets | Prevent any accidental credential leakage into client bundles with static and runtime guards | Accepted |
| D-15 | Enforce private schema for raw operational data and public schema for RLS-protected releases | Eliminate direct PostgREST exposure of raw personnel, leave, duty, and deployment data | Accepted |
| D-16 | Forbid RLS on materialized views | PostgreSQL engine does not support RLS on materialized views; aggregations remain in private schema | Accepted |
| D-17 | Restrict role provisioning and break-glass reads to SECURITY DEFINER service_role functions | Prevent client-side role elevation, unit self-assignment, or unlogged individual table reads | Accepted |
| D-18 | `backend/src/release.js` derives the public release band (`normal`/`elevated`/`high`) independently via `deriveReleaseBand()`, never from `ml/src/scoring.js`'s `band` field | `scoring.js`'s internal `band` uses a different vocabulary (`Normal`/`Review`/`Elevated`) for debugging and is asserted by existing Phase-1 ml tests; the public DB check constraint only accepts `normal/elevated/high/insufficient_data`. `scripts/seed-demo.js` already worked around this the same way. Changing `scoring.js` would break passing tests and isn't required. | Accepted |
| D-19 | Domain coverage in `backend/src/metrics.js` is the minimum of per-domain verified-record ratios (hr/leave/duty/deployment), and a person missing a domain's verified record is excluded from that domain's average rather than counted as zero | Matches docs/06's "80% verified coverage in each core source domain" and "missing data cannot be interpreted as zero activity"; deployment coverage counts a person as covered once their enrollment (`history_start_on`) is verified, since an absent deployment row for an enrolled person is itself the verified "not deployed" signal, not missing data | Accepted; revisit if a real deployment feed can express explicit "not deployed" rows |
| D-20 | `runWeeklyRelease()` returns both `privateMetrics` (exact) and `publicRelease` (suppressed/noised) in one object, guarded only by a JSDoc warning telling future API routes to serialize `.publicRelease` only | Independent Phase 2 verification pass confirmed no code path currently leaks `privateMetrics`, but no Phase 3+ route exists yet to enforce this at a type/schema level either; a doc-only guard is the cheapest fix that doesn't block Phase 2 | **Resolved by construction in Phase 3**: `frontend/src/app/api/commander/units*` routes only ever call `buildApiUnitPayload()`, which reads named fields off a `public.unit_week_releases` row, never off `runWeeklyRelease()`'s return value. No route touches `.privateMetrics`. |
| D-21 | The commander UI displays docs/04-user-flows.md's band vocabulary ("Normal, Review, Elevated") via `mapBandToDisplayLabel()` in `frontend/src/lib/commander/view-model.js`, translated from the DB's stored `unit_week_releases.band` vocabulary (`normal`/`elevated`/`high`, D-18) | docs/04 (UX spec) and the Phase 1 DB check constraint (D-15) use two different three-tier vocabularies for the same thresholds (40/70) — the same kind of mismatch as D-18, this time between a UX doc and the schema rather than between two code modules. Never query or persist using the UI label vocabulary. | Accepted |
| D-22 | Commander pages/routes check `isSupabaseConfigured()` first and render/return a plain "backend not configured" state (200 for pages, 503 for API) instead of throwing when `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` are unset | This host has no live Supabase instance (Docker/Podman missing, same blocker as Phases 1-2). This is an environment-configuration check, not an auth bypass — it never grants access, only fails more legibly than an unhandled exception. Verified for real via `curl` against `npm run dev` (200 on pages, 503 + `Cache-Control: no-store` on the API). | Accepted |
| D-23 | `frontend/src/lib/commander/view-model.js`'s `buildSuggestedActions()` returns deterministic, rule-based text using only docs/07's 5 permitted action categories and "consider"/"review" framing — no AI call, no free text | Phase 5 (AI adapter) doesn't exist yet, but docs/07 already specifies this exact deterministic-fallback behavior for when a model is unavailable; building it now gives Phase 3's unit detail page real action cards without waiting for Phase 5 | Accepted; Phase 5 should treat this function as its fallback template, not build a separate one |
| D-24 | Concurrency and retry idempotency in `backend/src/worker.js` rely on Postgres unique partial index `idx_welfare_reports_active_per_unit` and constraint `uq_welfare_report_retry`. | When concurrent workers race or jobs retry, Postgres error `23505` (or duplicate key constraint) is trapped and counted as `reportsDeduplicated++` without job failure, guaranteeing at most one active report per unit. | Accepted |
| D-25 | Overdue review calculation in `backend/src/welfare.js` and `frontend/src/lib/welfare/view-model.js` evaluates scheduled follow-up dates in the past (`follow_up_on < todayUtc`) and unacknowledged cases older than 48 hours in `new` status. | Closed reports are never overdue. In-app alerts render at the top of `/welfare` without email dispatch in MVP (per docs/03 and SRS requirement: no email dispatch of case details in MVP). | Accepted |

## Change procedure

For any changed threshold, source field, role, privacy threshold, AI prompt contract, or hosting environment:

1. Update the relevant decision entry.
2. Update dependent specifications.
3. Add or modify tests.
4. Rerun the security/privacy release gates.