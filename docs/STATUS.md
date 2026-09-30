# STATUS — Unit Pulse 2.0

_Last updated: 2026-09-30 by Antigravity during Phase 5 completion + verification pass_

## Current phase
Phase 0 — Scaffold and environment  →  **COMPLETE / VERIFIED** (tag `phase-0-complete` verified in repo)
Phase 1 — Schema, roles, synthetic seed  →  **COMPLETE / VERIFIED** (`phase-1-complete`)
Phase 2 — Metrics, index, baseline, and privacy release  →  **COMPLETE / AGENT-VERIFIED** (`phase-2-complete`)
Phase 3 — Commander dashboard and walkthrough  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-3-complete`)
Phase 4 — Weekly report and welfare workflow  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-4-complete`)
Phase 5 — AI adapter and aggregate briefing  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-5-complete`)

## Phase completion table
| Phase | Implemented | Agent-verified | Manually verified | Tag |
|---|---|---|---|---|
| 0 | ✅ | ✅ | ✅ | `phase-0-complete` |
| 1 | ✅ | ✅ | ⬜ (Ready for review) | `phase-1-complete` |
| 2 | ✅ | ✅ | ⬜ (Ready for review) | `phase-2-complete` |
| 3 | ✅ | ✅ | ⬜ (Ready for review) | `phase-3-complete` |
| 4 | ✅ | ✅ | ⬜ (Ready for review) | `phase-4-complete` |
| 5 | ✅ | ✅ | ⬜ (Ready for review) | `phase-5-complete` |
| 6 | ⬜ | ⬜ (NOT RUN) | ⬜ | |

## What works right now
- `npm run lint` succeeds across all workspaces (ESLint on frontend; custom zero-secret linters on backend [11 files] and ml [6 files]).
- `npm run test` succeeds with **165 passed tests** (was 138 at end of Phase 4):
  - 45 frontend tests (was 39): commander view-model & authorization, welfare authorization, welfare repository, welfare inbox view-model, and briefings route authorization/repository/privacy.
  - 103 backend tests (was 82): worker idempotency, CRON_SECRET auth, trigger rules, deduplication, status transitions, overdue review calculation, and 21 comprehensive AI adapter tests (deterministic safe fallbacks, adversarial input rejections, provider outage/timeouts, 429/500 bounded retries, capability handling, privacy invariant assertion, server-side assembly, provider switching, and zero-secret protection).
  - 17 ml tests — pure deterministic scoring, boundaries, and trigger rules.
- `npm run test:e2e` passes **19/19** (was 17/17): includes checks for AI adapter file existence, print route, and functional smoke tests for deterministic fallback, safety rejection, server-side assembly, and zero personnel data leak.
- `npm run build` succeeds; `/commander`, `/commander/units/[id]`, `/welfare`, `/welfare/reports/[id]`, `/api/briefings/[unitId]`, `/api/briefings/[unitId]/events`, `/api/briefings/[unitId]/print`, `/api/internal/weekly-run`, and all API routes compile as dynamic (ƒ) with `Cache-Control: no-store` enforced via middleware.
- **New this phase**:
  - `backend/src/ai-adapter.js`: server-only OpenAI-compatible provider adapter configured by `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_JSON_MODE`, `AI_TIMEOUT_MS`.
  - Capability difference handling: automatically detects when a provider rejects `response_format: { type: "json_object" }` (HTTP 400) and transparently retries without it.
  - Outbound privacy guard: `assertOutboundPayloadSafety` strictly verifies before any network call that outbound payload contains zero personnel IDs, names, raw records, exact locations, or typed reasons.
  - Strict safety rejection: rejects any model response containing clinical diagnoses ("depressed", "burnout", "PTSD"), punitive suggestions ("disciplinary action", "punish", "misconduct"), unsupported causal claims ("caused by", "causes"), unapproved evidence keys or action categories, or invented percentages not in approved metrics.
  - Server-side numerical assembly: displayed numbers in contributing factors are assembled server-side from approved release values; model text numbers are never trusted.
  - Deterministic safe fallback: in `NO_LLM_MODE=true` or on any provider failure, timeout, 429, 500, or safety rejection, produces 100% compliant, evidence-grounded aggregate explanations with the non-diagnostic safety disclaimer.
  - Weekly aggregate briefing storage: `public.unit_week_releases.briefing_json` (migration `20260930140000_phase5_briefings.sql`) and `public.welfare_reports.briefing_json`.
  - Stored aggregate briefing API: `GET /api/briefings/:unitId?week=YYYY-MM-DD` scoped to assigned unit roles.
  - Section-by-section SSE route: `GET /api/briefings/:unitId/events` streams only already-validated stored sections—never raw model tokens.
  - Print-friendly aggregate HTML view: `GET /api/briefings/:unitId/print` formatted specifically for browser *Print &rarr; Save as PDF* with `@page` and `@media print` rules, non-diagnostic safety disclaimer at top and bottom, and zero personnel data.
  - UI integration: Added "Print Aggregate Briefing (PDF)" buttons to commander unit detail and welfare report pages.

| Command | Exit code | Notes |
|---|---|---|
| `npm run lint` | 0 | ESLint clean on frontend; zero-secret lint clean on backend (11 files) & ml (6 files) |
| `npm run test` | 0 | 165 passed (45 frontend, 103 backend, 17 ml) |
| `npm run test:e2e` | 0 | 19/19 passed |
| `npm run build` | 0 | All commander, welfare, briefing, and internal API routes compile dynamic (ƒ) |

## Independent Phase 5 verification pass (Guidebook verification prompt)
Per: "Mock the provider returning: invalid JSON, an invented percentage, a diagnosis, a punitive action, a timeout, and HTTP 429. For each, confirm deterministic safe fallback. Inspect the outbound provider request for person IDs, raw rows, exact locations, typed welfare reasons, and hidden suppressed figures. Confirm switching provider settings needs no UI or score-code change."

- **Mocked Failure Scenarios (All confirmed deterministic safe fallback)**:
  1. `invalid JSON`: model returns non-JSON text &rarr; `validateModelOutput` catches &rarr; safe fallback returned (`source: 'deterministic_fallback'`).
  2. `invented percentage`: model text asserts "87% of personnel are fatigued" when 87 was not in approved metrics &rarr; caught &rarr; safe fallback returned.
  3. `diagnosis`: model text mentions "severe depression and burnout" &rarr; caught &rarr; safe fallback returned.
  4. `punitive action`: model recommends "disciplinary sanctions for duty refusal" &rarr; caught &rarr; safe fallback returned.
  5. `timeout`: provider hangs beyond `timeoutMs` &rarr; `AbortController` triggers timeout &rarr; safe fallback returned.
  6. `HTTP 429`: provider returns rate-limit &rarr; bounded retry (1 of 1) &rarr; safe fallback returned.
  7. `HTTP 500`: provider internal error &rarr; bounded retry (1 of 1) &rarr; safe fallback returned.
  8. `capability difference`: provider returns 400 Bad Request on `response_format` &rarr; transparent retry without `response_format` &rarr; successfully parses valid JSON.
- **Outbound Provider Request Inspection**:
  - Inspected serialized prompt messages and verified presence of approved aggregate indicators only (unit code, week, approximate index band, rolling baseline, allowed evidence keys).
  - Confirmed ZERO personnel identifiers (`PER-`), ZERO names, ZERO raw rows, ZERO exact locations, ZERO typed reasons, and ZERO unreleased exact metrics.
- **Provider Switching Invariant**:
  - Confirmed switching `AI_BASE_URL`, `AI_MODEL`, `AI_JSON_MODE` requires NO modification to scoring code (`@unitpulse/ml`) or frontend UI components.
- **Zero-Secret Invariant**:
  - Verified `AI_API_KEY` is never logged in errors or included in client-visible responses.

## What does NOT work / not implemented yet
- **Remote hosted Supabase instance not yet connected.** All database logic runs against unit test mocks or degrades gracefully when env vars are unset.
- Break-glass individual access flow and audit log (Phase 6).

## Known issues
- Docker Desktop or Podman is not installed on this host environment. Remote hosted Supabase is preferred by the user to avoid Docker.
- `scripts/seed-demo.js` fabricates weekly metrics directly rather than deriving them via `metrics.js`/`release.js` — unchanged since Phase 2.

## Environment facts the next agent needs
- This host: Node v20.20.2, npm 10.8.2. npm workspaces (`frontend`, `backend`, `ml`). Root `package.json` contains `"type": "module"`.
- Frontend dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `next`, `react`, `react-dom`.
- Real test results: `tests/results/phase-1-2026-09-30.txt`, `phase-2-2026-09-30.txt`, `phase-3-2026-09-30.txt`, `phase-4-2026-09-30.txt`, `phase-5-2026-09-30.txt`.

## Decisions made this phase
- D-26: Server-only OpenAI-compatible adapter (`backend/src/ai-adapter.js`) with capability difference handling, safety rejection (diagnoses, punitive terms, definite causal claims, invented metrics), server-side statement assembly from approved release values, and deterministic fallback templates.
- D-27: Store weekly aggregate briefing on `public.unit_week_releases.briefing_json` (migration `20260930140000_phase5_briefings.sql`) and `public.welfare_reports.briefing_json`. SSE route `/api/briefings/:unitId/events` streams only already-validated stored sections.
- D-28: Print-to-PDF aggregate briefing route `GET /api/briefings/:unitId/print` formatted with `@media print` CSS for standard browser Print &rarr; Save as PDF.

## Open questions for the human
- Ready to proceed to Phase 6 (Break-glass access and audit) or link remote Supabase project?
