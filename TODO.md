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
| **Phase 3** | Commander Dashboard & Walkthrough | `frontend/src/app/commander/`, trends, cards, accessible charts | ⏳ **PENDING (Phase 3)** |
| **Phase 4** | Weekly Report & Welfare Workflow | `frontend/src/app/welfare/`, Vercel cron worker, overdue alerts | ⏳ **PENDING (Phase 4)** |
| **Phase 5** | AI Adapter & Briefing | OpenAI adapter, fallback templates, print-to-PDF export | ⏳ **PENDING (Phase 5)** |

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

### ⏳ Phase 3 — Commander Dashboard & Walkthrough
- [ ] **Pages & Layouts (`frontend/src/app/commander/`)**:
  - [ ] `/commander`: Unit-card grid displaying status bands (`Normal`, `Review`, `Elevated`).
  - [ ] `/commander/units/[id]`: Weekly trend chart against rolling baseline, leave/night-duty indicators.
  - [ ] High-contrast accessible charts with text alternatives for colors.
  - [ ] Clear suppression UI state ("Insufficient group size to show this view").
  - [ ] "How this works" explanation drawer explaining the 3 Core Principles.
  - [ ] First-time walkthrough: "See Unit Health &rarr; Understand Possible Contributors &rarr; Consider Supportive Actions".
- [ ] **Security Enforcement**:
  - [ ] Route handlers enforce `Cache-Control: no-store`.
  - [ ] Verify responses contain zero personnel IDs, individual rows, or hidden metrics.
  - [ ] Cross-unit URL tampering denied with 403/404.

---

### ⏳ Phase 4 — Weekly Report & Welfare Workflow
- [ ] **Welfare Officer Portal (`frontend/src/app/welfare/`)**:
  - [ ] `/welfare`: Assigned reports inbox with status badges (`new`, `acknowledged`, `action_taken`, `follow_up`, `closed`).
  - [ ] `/welfare/reports/[id]`: Aggregate snapshot, trigger reasons, and follow-up form.
  - [ ] `/welfare/audit`: Officer's personal access audit trail.
  - [ ] Overdue review indicator for reports pending past SLA.
- [ ] **Break-Glass Individual Access Flow**:
  - [ ] Modal requiring documented justification and reason code.
  - [ ] Server-enforced 30-minute expiry; reason encrypted with AES-256-GCM.
  - [ ] Paginated reads (max 20 records) with transactional audit logging.
- [ ] **Weekly Job & Vercel Cron (`backend/src/worker.js`)**:
  - [ ] Protected GET route `/api/internal/weekly-run` verified with `Authorization: Bearer <CRON_SECRET>`.
  - [ ] Deduplication: at most 1 active report per unit on concurrent/retried cron runs.

---

### ⏳ Phase 5 — AI Adapter & Briefing
- [ ] **Server-Only LLM Adapter (`backend/src/ai-adapter.js`)**:
  - [ ] Switchable OpenAI-compatible client configured via `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`.
  - [ ] Pass only privacy-approved aggregate metrics and allow-listed evidence codes.
  - [ ] Validate structured output; assemble numerical statements server-side.
  - [ ] Deterministic fallback templates in `NO_LLM_MODE=true` or when provider is unavailable.
- [ ] **Print-to-PDF Aggregate Briefing**:
  - [ ] Print-friendly aggregate HTML view at `/api/briefings/:unitId/print`.
  - [ ] Support native browser Print &rarr; Save as PDF (no claim of external PDF server).

---

## Release Gate Checklist (Must pass before production deployment)
- [ ] No personnel-level rows returned to commander endpoints.
- [ ] Small groups (<5) and small cells completely suppressed in API and UI.
- [ ] Zero unlogged individual reads across the entire application.
- [ ] Cron retries do not duplicate active welfare reports.
- [ ] AI model receives no direct personnel identifiers or unreleased metrics.
- [ ] Zero hardcoded service keys or client-prefixed secrets (`NEXT_PUBLIC_`) in codebase.
