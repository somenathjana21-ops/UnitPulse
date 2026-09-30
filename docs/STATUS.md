# STATUS — Unit Pulse 2.0

_Last updated: 2026-09-30 by Claude Code during Phase 3 completion + verification pass_

## Current phase
Phase 0 — Scaffold and environment  →  **COMPLETE / VERIFIED** (tag `phase-0-complete` verified in repo)
Phase 1 — Schema, roles, synthetic seed  →  **COMPLETE / VERIFIED** (`phase-1-complete`)
Phase 2 — Metrics, index, baseline, and privacy release  →  **COMPLETE / AGENT-VERIFIED** (`phase-2-complete`)
Phase 3 — Commander dashboard and walkthrough  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-3-complete`)
Phase 4 — Weekly report and welfare workflow  →  **PENDING IMPLEMENTATION**

## Phase completion table
| Phase | Implemented | Agent-verified | Manually verified | Tag |
|---|---|---|---|---|
| 0 | ✅ | ✅ | ✅ | `phase-0-complete` |
| 1 | ✅ | ✅ | ⬜ (Ready for review) | `phase-1-complete` |
| 2 | ✅ | ✅ | ⬜ (Ready for review) | `phase-2-complete` |
| 3 | ✅ | ✅ | ⬜ (Ready for review — see honest gaps below) | `phase-3-complete` |
| 4 | ⬜ | ⬜ (NOT RUN) | ⬜ | |

## What works right now
- `npm run lint` succeeds across all workspaces (ESLint on frontend; custom zero-secret linters on backend [9 files] and ml [6 files]).
- `npm run test` succeeds with **96 passed tests** (was 73 at end of Phase 2):
  - 25 frontend tests (was 2): commander view-model (band mapping, suppression wording, evidence/action cards, API payload shaping, no-leak-on-malicious-input), authorization (401/404 verdicts, no existence oracle for guessed unit IDs), and repository functions against a fake Supabase client (never returns a unit outside the requested scope).
  - 54 backend tests — unchanged from Phase 2.
  - 17 ml tests — unchanged from Phase 2.
- `npm run test:e2e` passes **15/15** (was 13/13): added a Phase 3 file-existence check and a functional smoke test (cross-unit denial + no forbidden field in an API payload built from a deliberately "leaky" source row).
- `npm run build` succeeds; `/commander`, `/commander/units/[id]`, and both `/api/commander/units*` routes all compile as dynamic (ƒ) — never statically prerendered, confirmed in the build output itself.
- **New this phase**: `/commander` (unit-card grid) and `/commander/units/[id]` (weekly trend + evidence + deterministic suggested actions) as real Next.js Server Components using real Supabase Auth (`@supabase/ssr`) — not a mock or bypass. `GET /api/commander/units[/:unitId]` route handlers match docs/08's response shape. `frontend/src/middleware.js` enforces `Cache-Control: no-store` on both.
| Command | Exit code | Notes |
|---|---|---|
| `npm run lint` | 0 | ESLint clean on frontend; zero-secret lint clean on backend (9 files) & ml (6 files) |
| `npm run test` | 0 | 96 passed (25 frontend, 54 backend, 17 ml) |
| `npm run test:e2e` | 0 | 15/15 |
| `npm run build` | 0 | `/commander`, `/commander/units/[id]`, and both API routes all render as dynamic (ƒ), never statically prerendered |
| `npm run dev` + `curl` | — | Manual, real HTTP verification (see below) — not an automated command, recorded for the record |

## Independent Phase 3 verification pass (Guidebook verification prompt, run this session)
Per: "Inspect both HTML and network responses for names, person IDs, raw metrics, hidden small-group counts, location details, and private case notes. Verify keyboard interaction and text alternatives for chart colors. Check cache headers and confirm a role-specific page is not statically cached or shared between users. Report browser tests actually run."

- **HTML/network inspection for leaked fields**: could not inspect a *populated* dashboard (no live Supabase, no released data reachable). Verified the equivalent guarantee structurally instead: `buildApiUnitPayload()` only ever reads named fields from a release row and constructs a new object — tested that even a source row carrying a `personnel_id` field never lets it through, and the result passes `@unitpulse/backend`'s `validatePublicReleasePayload()`.
- **Cache headers**: genuinely tested, not assumed. `curl -D -` against a running `npm run dev` confirmed `Cache-Control: no-store` on `GET /commander` (page) and `GET /api/commander/units` (API, including its 503 error response).
- **Role-specific page not statically cached**: confirmed in the `npm run build` output — `/commander`, `/commander/units/[id]`, and both API routes are marked `ƒ (Dynamic)`, never `○ (Static)`.
- **Keyboard interaction**: **not empirically tested.** The Claude in Chrome browser tool was available but the user chose not to connect it this session. What's true by construction: unit cards are native `<Link>`/`<a>` elements, the "How this works" drawer is native `<details>/<summary>`, and the trend chart's real accessible content is a plain `<table>` — all natively keyboard-operable without custom JS or ARIA workarounds. This is a reasonable inference from standard HTML semantics, not a verified observation.
- **Text alternatives for chart colors**: verified by code review. `TrendChart.js` always renders a full `<table>` with identical values (not gated behind a toggle), and distinguishes the index/baseline lines by *both* color and line style (solid vs. dashed) — identity is never color-alone.
- **Cross-unit URL tampering**: tested — a real neighboring unit ID and a completely fabricated one produce byte-identical 404 responses (`resolveCommanderUnitAccess`), so a guess can never confirm whether a unit exists.
- **Browser tests actually run**: **none.** What was actually run: `curl` against a live `npm run dev` process (real HTTP, real headers, real status codes, real rendered HTML — but only for the unauthenticated/not-configured states), plus 96 Node.js unit/logic tests. No DOM was ever rendered in a browser or inspected visually this session.

## What does NOT work / not implemented yet
- **The commander dashboard has never run against real data.** No live Supabase/Postgres instance was connected on this host. Every Supabase-calling code path (`repository.js`'s actual queries, real session auth) is real production code, never executed against a live database.
- No browser-based accessibility or visual testing was performed (see verification pass above).
- `scripts/seed-demo.js` still fabricates weekly metrics directly rather than deriving them via `metrics.js`/`release.js` — unchanged since Phase 2, still an open question below.
- Welfare inbox and report detail UI (`/welfare`, scheduled for Phase 4).
- Break-glass individual access flow (Phase 4).
- Vercel cron weekly worker (Phase 4).
- AI adapter and briefing generation (Phase 5). Note: `buildSuggestedActions()` in `frontend/src/lib/commander/view-model.js` already implements the deterministic-fallback *style* of action text from docs/07, ahead of schedule — Phase 5 should reuse it as the fallback template rather than duplicating it (D-23).

## Known issues
- Docker Desktop or Podman is not installed on this host environment. Remote hosted Supabase is preferred by the user to avoid Docker.
- `phase-0-complete` git tag was missing from repo — **RESOLVED** on 2026-09-30 (tagged commit `7b9783a`).
- `frontend/src/middleware.js`'s matcher only covers `/commander/*` and `/api/commander/*` — Phase 4 must extend it for `/welfare/*` or those routes won't get `no-store`.

## Environment facts the next agent needs
- This host: Node v20.20.2, npm 10.8.2. npm workspaces. Root `package.json` contains `"type": "module"`. (Note: `@supabase/auth-js` logs engine warnings recommending Node >= 22.0.0, but builds and tests pass cleanly).
- New frontend dependencies this phase: `@supabase/ssr`, `@supabase/supabase-js`.
- No `frontend/.env.local` exists on this host — `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset, so `isSupabaseConfigured()` is false and commander pages/routes render/return the graceful "not configured" state (D-22).
- Real test results: `tests/results/phase-1-2026-09-30.txt`, `phase-2-2026-09-30.txt`, `phase-3-2026-09-30.txt`.
- AGENTS.md and CLAUDE.md re-checked against the current codebase this phase: still accurate; no root npm script changes needed (Phase 3 added frontend dependencies and files, not new root scripts).

## Decisions made this phase
- D-21: UI band vocabulary (docs/04: Normal/Review/Elevated) is mapped from the DB's stored band vocabulary (D-18: normal/elevated/high) via `mapBandToDisplayLabel()`. Never query or persist using the UI label vocabulary.
- D-22: commander pages/routes check `isSupabaseConfigured()` and degrade gracefully (200/503) instead of crashing when Supabase env vars are unset — an environment check, not an auth bypass.
- D-23: `buildSuggestedActions()` is a real, permanent deterministic-fallback implementation per docs/07, intended for Phase 5 to reuse rather than replace.
- D-20 (from Phase 2) marked resolved by construction: the new API routes only ever call `buildApiUnitPayload()` against a published release row, never `runWeeklyRelease()`'s raw return value.
- One Phase 1 test caught a real mistake during implementation: `backend/tests/permissions.test.js`'s Hostile Scenario 2 scans all of `frontend/src` for the literal string naming the elevated Supabase credential — a warning comment in the new `frontend/src/lib/supabase/server.js` originally spelled that string out and tripped the check. Reworded the comment rather than weakening the test.

## Open questions for the human
- User confirmed remote hosted Supabase will be used (no local Docker). Next step is linking the project and pushing migrations/seed.
- Should `scripts/seed-demo.js` be rewritten to derive `unitWeekMetrics`/`unitWeekReleases` from raw records via `backend/src/metrics.js` + `release.js`? Carried over from Phase 2, unresolved.
- Would you like a Claude in Chrome pass in a future session to empirically verify keyboard navigation and screen-reader behavior on `/commander`, once either a live Supabase project exists or a decision is made about how to demo this phase without one?
