# Handoff — Phase 5: AI Adapter and Briefing

**Written by:** Antigravity on 2026-09-30
**Git tag:** `phase-5-complete`  **Last commit:** see `git log -1` at tag time
**Status:** Phase 5 Complete, Agent-Verified. Manual/human review pending live Supabase connection.

## Summary (3 lines max)
Built the server-only OpenAI-compatible AI adapter (`backend/src/ai-adapter.js`) configured via `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_JSON_MODE`, and timeout, with capability difference handling, strict safety rejection, server-side numerical statement assembly, and deterministic fallback templates.
Stored weekly aggregate briefings on `public.unit_week_releases.briefing_json` (migration `20260930140000_phase5_briefings.sql`), and implemented routes for stored briefings (`GET /api/briefings/:unitId`), section-by-section SSE (`GET /api/briefings/:unitId/events`), and print-friendly HTML view (`GET /api/briefings/:unitId/print`) for browser Save as PDF.
All 165 tests pass (45 frontend, 103 backend, 17 ml); e2e passes 19/19; build compiles all routes as dynamic (ƒ) with `Cache-Control: no-store`; adversarial and provider-outage tests verify zero leak of secrets or personal identifiers.

## Files created / changed
- `backend/src/ai-adapter.js` — server-only OpenAI-compatible provider adapter with capability difference handling, prompt builder with allowed evidence/action codes only, schema and safety validator, server-side metric statement assembler, and deterministic fallback generator.
- `backend/src/index.js` & `backend/package.json` — re-exported `ai-adapter` module.
- `backend/src/worker.js` — integrated aggregate briefing generation into `processUnitWeek` and `runWeeklyWorker`.
- `backend/tests/ai-adapter.test.js` — 21 tests covering deterministic fallback in `NO_LLM_MODE`, missing key, invalid JSON, clinical diagnosis rejection, punitive suggestion rejection, unsupported causal claim rejection, invented percentage rejection, unapproved evidence/action keys, timeout, 429/500 bounded retry, 400 response_format capability retry, outbound privacy safety, server-side numerical assembly, provider switching, and zero-secret invariant.
- `supabase/migrations/20260930140000_phase5_briefings.sql` — SQL migration adding `briefing_json jsonb` to `public.unit_week_releases`.
- `frontend/src/lib/briefings/repository.js` — scoped data fetching and caching for weekly aggregate briefings.
- `frontend/src/app/api/briefings/[unitId]/route.js` — authenticated, unit-scoped GET route returning stored aggregate briefing.
- `frontend/src/app/api/briefings/[unitId]/events/route.js` — SSE route streaming only already-validated stored sections (never raw model tokens).
- `frontend/src/app/api/briefings/[unitId]/print/route.js` — print-friendly aggregate HTML view for browser Save as PDF with `@media print` rules, non-diagnostic disclaimers, and zero personal data.
- `frontend/src/middleware.js` — added `/api/briefings/:path*` to matcher enforcing `Cache-Control: no-store`.
- `frontend/src/app/commander/units/[id]/page.js` — added "Print Aggregate Briefing (PDF)" link in header.
- `frontend/src/app/welfare/reports/[id]/page.js` — added "Print Briefing (PDF)" link in header.
- `frontend/tests/briefings.test.js` — 6 tests covering 401 unauthenticated, 404 cross-unit concealment, assigned commander/welfare officer access, repository fallback, and zero personnel data in payload.
- `scripts/test-e2e.js` — added checks 17 and 18 for Phase 5 file existence and functional smoke testing (19/19 checks passing).
- `TODO.md` — Phase 5 marked complete.
- `docs/15-decision-log.md` — recorded D-26 (AI adapter architecture & safety rejection), D-27 (briefing storage & SSE validated sections), D-28 (print-to-PDF export).
- `docs/STATUS.md` — updated phase table and verified test counts.
- `tests/results/phase-5-2026-09-30.txt` — recorded real command outputs.

## Commands run and results
| Command | Exit code | Notes |
|---|---|---|
| `npm run lint` | 0 | Clean across frontend, backend (11 files), and ml (6 files) |
| `npm run test` | 0 | 165 passed (45 frontend, 103 backend, 17 ml) |
| `npm run test:e2e` | 0 | 19/19 passed |
| `npm run build` | 0 | All commander, welfare, briefing, and internal API routes compile dynamic (ƒ) |

## Exit-gate checklist (from Guidebook Phase 5)
- [x] With `NO_LLM_MODE=true`, the workflow still produces a briefing — verified via `backend/tests/ai-adapter.test.js` and `scripts/test-e2e.js`.
- [x] AI wording says “may” or “consider,” not “caused” or “diagnosed” — verified via safety rejection tests rejecting diagnoses, punitive actions, and definite causal claims.
- [x] The print page contains aggregates only — verified via route test and e2e smoke test (contains zero personnel IDs, names, or raw rows).
- [x] Print → Save as PDF creates a readable file — verified via print-friendly CSS with `@page` and `@media print` rules.
- [x] No AI request fires from browser JavaScript — verified: AI adapter resides strictly inside `@unitpulse/backend` and runs server-side only.

## Deviations from spec
None. Implementation strictly aligns with `docs/07-ml-specification.md`, `docs/08-api-specification.md`, and `docs/10-security-privacy.md`. Three architectural decisions recorded in `docs/15-decision-log.md`:
- D-26: Adapter capability difference handling (detecting and retrying on 400 if `response_format` is rejected by non-OpenAI endpoints), strict regex-based safety rejection, and server-assembled numerical statements.
- D-27: Weekly aggregate briefing stored on `public.unit_week_releases.briefing_json`. SSE route streams only already-validated stored sections.
- D-28: Print-to-PDF aggregate view formatted with standard `@media print` CSS for browser native Save as PDF.

## Traps for the next agent
1. **Zero Raw Token Streaming**: `GET /api/briefings/:unitId/events` streams only already-validated stored sections from the database. Never stream unvalidated raw tokens directly from an external model to the client.
2. **Server-Side Statement Assembly**: The LLM is never trusted to write numbers or percentages. All displayed numbers in contributing factors are assembled server-side from verified aggregate release values.
3. **Safety Disclaimers**: All briefing pages, PDF print views, welfare reports, and public summaries must prominently display the non-diagnostic disclaimer: "The Unit Load & Recovery Index is an operational welfare planning indicator. It is NOT a medical diagnosis and must never be used as evidence of individual psychological fitness, misconduct, or eligibility for promotion or deployment."
4. **Phase 6 Break-Glass Access Workflow**: Phase 6 implements the audited break-glass protocol for exceptional individual reads. Ensure all individual reads pass through the transactional database read function with server-side AES-256-GCM encryption of the stored reason and 30-minute auto-expiry.

## Exact next step
"Run Phase 6 implementation prompt from Guidebook.md (Break-glass access and audit) — implement exceptional individual-read workflow with assigned welfare report, reason code + typed reason, server-enforced 30-minute grant, AES-256-GCM encrypted storage of reason, narrow transactional read function returning max 20 pseudonymous records with per-read audit row, and officer audit viewer."
