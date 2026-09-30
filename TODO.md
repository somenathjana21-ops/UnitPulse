# Unit Pulse 2.0 — Implementation Roadmap & Unfinished Features TODO

> **Status:** Phase 0 (Scaffold & Environment) Complete.  
> **Environment:** Synthetic Demo Prototype only.  
> **Safety Notice:** The Unit Load & Recovery Index is an operational welfare planning indicator, NOT a medical or psychological diagnosis.

---

## Phase Status Summary

| Phase | Title | Target Scope | Status |
|---|---|---|---|
| **Phase 0** | Scaffold & Environment | Root, `frontend/`, `backend/`, `ml/`, `scripts/`, `.gitignore` | ✅ **COMPLETED** |
| **Phase 1** | Schema, Roles & Synthetic Seed | `supabase/migrations/`, `scripts/seed-demo.js`, role RLS | ✅ **COMPLETED** |
| **Phase 2** | Metrics, Index, Baseline & Privacy Release | `backend/src/release.js`, `ml/src/`, Laplace noise, fixtures | ✅ **COMPLETED** |
| **Phase 3** | Commander Dashboard & Walkthrough | `frontend/src/app/commander/`, trends, cards, accessible charts | ✅ **COMPLETED** |
| **Phase 4** | Weekly Report & Welfare Workflow | `frontend/src/app/welfare/`, Vercel cron worker, overdue alerts | ✅ **COMPLETED** |
| **Phase 5** | AI Adapter & Briefing | OpenAI adapter, fallback templates, print-to-PDF export | ✅ **COMPLETED** |
| **Phase 6** | Break-Glass Access & Audit | 30-min grant, AES-256-GCM encryption, narrow transactional read, officer audit viewer | ✅ **COMPLETED** |
| **Phase 7** | Import, Hardening & Accessibility | Restricted `/admin/import` synthetic CSV, limits, accessible charts | ⏳ **PENDING (Phase 7)** |

---

## Detailed Task Breakdown

### ✅ Phase 0 — Scaffold & Environment (Completed)
- [x] Configure npm workspaces for `frontend/` (Next.js App Router, JS), `backend/` (server-only domain), and `ml/` (deterministic analytics).
- [x] Create root `package.json` scripts: `dev`, `lint`, `test`, `test:e2e`, `build`, and `seed:demo`.
- [x] Create `.gitignore` protecting `*.env.local`, `.env`, secrets, keys, and build artifacts.
- [x] Implement public explanation page (`/`) with synthetic-demo wording and "not a diagnosis" safety statement.
- [x] Implement `/login` page with role scope architecture and Supabase Auth placeholder (no fake auth, no client service keys).
- [x] Implement cross-workspace import verification between `frontend/`, `backend/`, and `ml/`.
- [x] Implement security audit script `scripts/test-e2e.js` checking for forbidden `NEXT_PUBLIC_` secret leaks.

---

### ✅ Phase 1 — Schema, Roles & Synthetic Seed (Completed)
- [x] **Database Migrations (`supabase/migrations/20260930120000_phase1_initial_schema.sql`)**:
  - [x] Create private schema for raw synthetic tables: `units`, `personnel`, `leave_records`, `duty_records`, `deployments`, `leave_eligibility`, `unit_week_metrics`, `access_grants`, `access_audit`.
  - [x] Ensure private schema is **not exposed** to browser clients (`REVOKE ALL ON SCHEMA private FROM public, anon, authenticated`).
  - [x] Create public release/report tables: `unit_week_releases`, `welfare_reports`, `user_roles`, `unit_assignments`.
  - [x] Enable Row-Level Security (RLS) on all public tables with strict role/unit assignment policies.
  - [x] Do **not** attempt to place RLS directly on a materialized view (architectural constraint documented in D-16).
  - [x] Create narrow database functions for scoped break-glass grant generation and transactional individual reads with logging (`private.execute_audited_break_glass_read`).
  - [x] Enforce at most one active welfare report per unit via partial unique index `idx_welfare_reports_active_per_unit`.
  - [x] Create narrow role provisioning procedure `public.provision_user_role` restricted to `service_role`.
- [x] **Synthetic Seed Generator (`scripts/seed-demo.js`)**:
  - [x] Generate 6 fictional units (`UNIT-A` through `UNIT-F`) with ~60 synthetic personnel each (360 total).
  - [x] Generate ~180 days of historical records with 12 completed weekly snapshots (plus 14 warm-up weeks).
  - [x] Create 1 elevated unit (`UNIT-B`: sustained high index >= 70, high night shifts, recovery gap > 35%, triggering 1 confidential report) and 1 stable unit (`UNIT-A`: index <= 25, regular leave, 0 reports).
  - [x] Zero real personnel names, real force identifiers, or operational locations.
  - [x] Output complete idempotent SQL statements to `supabase/seed.sql`.
- [x] **Permission Integration Tests (`backend/tests/permissions.test.js`)**:
  - [x] Verify anonymous and commander users cannot query raw personnel rows.
  - [x] Verify changing unit ID in queries does not reveal unauthorized unit data.
  - [x] Verify users cannot self-assign or escalate roles.
  - [x] Verify zero personnel identifiers in public release datasets.

---

### ✅ Phase 2 — Metrics, Index, Baseline & Privacy Release (Completed)
- [x] **Backend Source Aggregation (`backend/src/metrics.js`)**:
  - [x] 90-day leave utilization and coverage calculations.
  - [x] Recovery gap calculation (>60 days without qualifying leave).
  - [x] Leave denial rate calculation (with omission when decided requests < 5, enforced downstream in `ml/src/scoring.js`).
  - [x] 28-day mean night-duty shifts and 7-day mean workload hours.
  - [x] Continuous deployment duration calculation (verified non-deployed = confirmed 0, never assumed).
  - [x] 80% source coverage threshold enforcement per domain (missing data = "insufficient data", not 0).
- [x] **Privacy Release Pipeline (`backend/src/release.js`)**:
  - [x] Enforce k-anonymity suppression: withhold entire view if active personnel < 5.
  - [x] Enforce small-cell suppression: withhold cell or complement if < 5 (deployed-count and recovery-gap-count fields).
  - [x] Sample Laplace noise (epsilon = 0.2, sensitivity = 1.0) on bounded counts **once** per release.
  - [x] Idempotent: passing `existingRelease` back in returns the stored release unchanged; never resamples.
- [x] **Test Fixtures (`backend/tests/metrics.test.js`, `backend/tests/release.test.js`)**:
  - [x] Unit with group size 4 (fully suppressed).
  - [x] Unit with group size 5 and 1-person breakout (breakout suppressed, unit-level release still published).
  - [x] Incomplete duty coverage (no index generated, `insufficient_data` band).
  - [x] Repeated release calls returning identical stored noisy values.
  - [x] Baseline boundary (3 vs. 4 comparable prior weeks).
  - [x] Triggered unit (sustained-high) with cron-retry deduplication.
  - [x] `scripts/test-e2e.js` extended with Phase 2 module-export and functional smoke checks (13/13 passing).

---

### ✅ Phase 3 — Commander Dashboard & Walkthrough (Completed)
- [x] **Pages & Layouts (`frontend/src/app/commander/`)**:
  - [x] `/commander`: Unit-card grid displaying status bands (`Normal`, `Review`, `Elevated` — UI vocabulary, see D-21).
  - [x] `/commander/units/[id]`: Weekly trend chart against rolling baseline, leave/night-duty/workload evidence cards.
  - [x] Accessible chart: inline SVG (decorative) plus a real HTML `<table>` as the primary accessible representation; solid vs. dashed lines so identity is never color-alone.
  - [x] Clear suppression UI state, wording taken verbatim from docs/04 ("Insufficient group size to show this view.", "Not enough verified data for an index.", "Collecting comparable weeks.").
  - [x] "How this works" explanation drawer (native `<details>`/`<summary>`, keyboard-operable with no JS).
  - [x] First-time walkthrough: "See Unit Health → Understand Possible Contributors → Consider Supportive Actions" in the drawer.
  - [x] Deterministic (non-AI) suggested-action cards using only the 5 permitted categories from docs/07, ahead of the Phase 5 AI adapter.
- [x] **Security Enforcement**:
  - [x] `frontend/src/middleware.js` enforces `Cache-Control: no-store` on `/commander/*` and `/api/commander/*` — confirmed for real via `curl -I` against a running dev server, not just code review.
  - [x] `buildApiUnitPayload()` only ever reads named fields from the release row; tested that an accidental extra field (e.g. `personnel_id`) on the source row never propagates to the API response.
  - [x] Cross-unit URL tampering denied with 404 (never 403, to avoid confirming a guessed unit exists) — tested that a real neighboring unit and a fully fabricated unit ID produce byte-identical denial responses.

---

### ✅ Phase 4 — Weekly Report & Welfare Workflow (Completed)
- [x] **Welfare Officer Portal (`frontend/src/app/welfare/`)**:
  - [x] `/welfare`: Assigned reports inbox with status badges (`new`, `acknowledged`, `action_taken`, `follow_up`, `closed`).
  - [x] `/welfare/reports/[id]`: Aggregate snapshot, trigger reasons, suggested supportive actions, and interactive status transition workflow.
  - [x] In-app notification banners for new alerts and overdue reviews (replaces email dispatch per MVP privacy spec).
  - [x] Overdue review indicator for reports with past scheduled follow-up or unacknowledged >48 hours.
  - [x] Strict officer assignment access gate: only assigned officer can read/update (cross-officer attempts resolve to 404, commander to 403, anonymous to 401).
- [x] **Weekly Job & Vercel Cron (`backend/src/worker.js`)**:
  - [x] Protected GET route `/api/internal/weekly-run` verified with `Authorization: Bearer <CRON_SECRET>` server-side.
  - [x] Deterministic report triggers: spike rule (current >= 40 and >= baseline + 15 with >= 4 earlier comparable weeks) OR sustained-high rule (current >= 75 for 2 consecutive completed weeks).
  - [x] Deduplication: at most 1 active report per unit on concurrent/retried cron runs via database constraints (`idx_welfare_reports_active_per_unit` partial unique index and `uq_welfare_report_retry`).
  - [x] Middleware enforces `Cache-Control: no-store` across `/welfare/*`, `/api/welfare/*`, and `/api/internal/*`.

---

### ✅ Phase 5 — AI Adapter & Briefing (Completed)
- [x] **Server-Only LLM Adapter (`backend/src/ai-adapter.js`)**:
  - [x] Switchable OpenAI-compatible client configured via `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_JSON_MODE`, `AI_TIMEOUT_MS`.
  - [x] Pass only privacy-approved aggregate metrics and allow-listed evidence codes (`leave_recovery`, `night_duty`, `continuous_deployment`, `weekly_hours`, `leave_utilization`).
  - [x] Validate structured output; assemble numerical statements server-side from approved release values.
  - [x] Strict safety rejection: rejects clinical diagnoses, punitive actions, definite causal claims, and invented metrics.
  - [x] Capability difference handling: automatically handles providers that reject `response_format: { type: "json_object" }` (400) by retrying cleanly without it.
  - [x] Deterministic fallback templates in `NO_LLM_MODE=true` or when provider is unavailable, rate-limited (429), or times out.
- [x] **Weekly Aggregate Briefing Storage (`supabase/migrations/20260930140000_phase5_briefings.sql`)**:
  - [x] Stored on `public.unit_week_releases.briefing_json` and `public.welfare_reports.briefing_json`.
  - [x] Endpoint `GET /api/briefings/:unitId` returns stored, validated briefing with `Cache-Control: no-store`.
  - [x] SSE endpoint `GET /api/briefings/:unitId/events` streams only validated stored sections (never raw model tokens).
- [x] **Print-to-PDF Aggregate Briefing**:
  - [x] Print-friendly aggregate HTML view at `/api/briefings/:unitId/print`.
  - [x] Formatted for native browser Print &rarr; Save as PDF with `@media print` page breaks, high-contrast typography, and zero personnel data.
  - [x] Non-diagnostic safety disclaimer displayed prominently at top and bottom.

---

### ✅ Phase 6 — Break-Glass Access & Audit (Completed)
- [x] **Audit & Encryption Domain Module (`backend/src/audit.js`)**:
  - [x] AES-256-GCM server-side encryption/decryption for stored free-text justifications with 12-byte random nonce and authentication tag.
  - [x] Compulsory minimum 10-character typed justification check.
  - [x] Reason code validation against allowed set (`welfare_review`, `roster_audit`, `safety_check`, `leave_rebalancing_assessment`, `emergency_support`).
  - [x] Server-enforced 30-minute auto-expiry duration; client cannot specify or alter duration.
  - [x] Active grant status and expiration evaluation (`isGrantActive`).
  - [x] Never log plaintext reasons to console or errors.
- [x] **Database Migration (`supabase/migrations/20260930150000_phase6_break_glass.sql`)**:
  - [x] Align `private.access_grants` reason code constraints.
  - [x] Transactional grant creation function `private.create_access_grant` (service-role only).
  - [x] Narrow transactional database read function `private.execute_audited_break_glass_read`: rechecks officer role, report assignment, grant validity, unit consistency, and grant expiry in one atomic transaction; clamps output to max 20 pseudonymous records; and writes an audit row to `private.access_audit`.
  - [x] Officer audit log query function `private.get_officer_audit_log` (service-role only, strictly scoped to calling officer).
  - [x] Revoke direct execution and ordinary SELECT on private tables from all client roles.
- [x] **API Route Handlers (`frontend/src/app/api/welfare/`)**:
  - [x] `POST /api/welfare/reports/:id/access-grants`: Authenticates officer, verifies report assignment, validates reason, encrypts justification at rest, returns 30-min grant metadata with `Cache-Control: no-store`.
  - [x] `GET /api/welfare/reports/:id/individuals`: Authenticates officer, validates active unexpired grant, calls transactional database read function, returns max 20 pseudonymous records with `Cache-Control: no-store`. Denies commanders with 403 (T-02), conceals unassigned reports with 404 (T-06), denies expired grants with 403 (T-08).
  - [x] `GET /api/welfare/audit`: Returns calling officer's own access audit events with `Cache-Control: no-store`.
- [x] **Frontend UI Integration**:
  - [x] `BreakGlassPanel.js`: Interactive break-glass request component on `/welfare/reports/[id]` with reason selection, justification text area, live 30-min countdown timer, and paginated table (max 20 rows/page).
  - [x] Officer Audit Viewer page at `/welfare/audit` showing immutable audit events (timestamp, action, unit, linked report, row count, reason code).
  - [x] Strict data safeguard: bulk export and download of individual rows prohibited; responses are strictly ephemeral and no-store.

---

## Release Gate Checklist (Must pass before production deployment)
- [x] No personnel-level rows returned to commander endpoints.
- [x] Small groups (<5) and small cells completely suppressed in API and UI.
- [x] Zero unlogged individual reads across the entire application (every individual read writes DB audit row in same transaction).
- [x] Cron retries do not duplicate active welfare reports.
- [x] AI model receives no direct personnel identifiers or unreleased metrics.
- [x] Zero hardcoded service keys or client-prefixed secrets (`NEXT_PUBLIC_`) in codebase.
