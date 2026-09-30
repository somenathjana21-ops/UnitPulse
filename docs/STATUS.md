# STATUS — Unit Pulse 2.0

_Last updated: 2026-09-30 by Antigravity during Phase 6 completion + verification pass_

## Current phase
Phase 0 — Scaffold and environment  →  **COMPLETE / VERIFIED** (tag `phase-0-complete` verified in repo)
Phase 1 — Schema, roles, synthetic seed  →  **COMPLETE / VERIFIED** (`phase-1-complete`)
Phase 2 — Metrics, index, baseline, and privacy release  →  **COMPLETE / AGENT-VERIFIED** (`phase-2-complete`)
Phase 3 — Commander dashboard and walkthrough  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-3-complete`)
Phase 4 — Weekly report and welfare workflow  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-4-complete`)
Phase 5 — AI adapter and aggregate briefing  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-5-complete`)
Phase 6 — Break-glass access and audit  →  **COMPLETE / AGENT-VERIFIED** (tag `phase-6-complete`)

## Phase completion table
| Phase | Implemented | Agent-verified | Manually verified | Tag |
|---|---|---|---|---|
| 0 | ✅ | ✅ | ✅ | `phase-0-complete` |
| 1 | ✅ | ✅ | ⬜ (Ready for review) | `phase-1-complete` |
| 2 | ✅ | ✅ | ⬜ (Ready for review) | `phase-2-complete` |
| 3 | ✅ | ✅ | ⬜ (Ready for review) | `phase-3-complete` |
| 4 | ✅ | ✅ | ⬜ (Ready for review) | `phase-4-complete` |
| 5 | ✅ | ✅ | ⬜ (Ready for review) | `phase-5-complete` |
| 6 | ✅ | ✅ | ⬜ (Ready for review) | `phase-6-complete` |
| 7 | ⬜ | ⬜ (NOT RUN) | ⬜ | |

## What works right now
- `npm run lint` succeeds across all workspaces (ESLint on frontend; custom zero-secret linters on backend [11 files] and ml [6 files]).
- `npm run test` succeeds with **191 passed tests** (was 165 at end of Phase 5):
  - 57 frontend tests (was 45): commander view-model & authorization, welfare authorization, welfare repository, welfare inbox view-model, briefings route authorization/repository/privacy, and 12 break-glass & audit authorization/repository tests (T-02 commander denial, T-06 unassigned 404 concealment, T-07 short reason rejection, T-08 expiry 403, T-09 clamped 20 rows + audit event logging, and officer audit trail isolation).
  - 117 backend tests (was 103): worker idempotency, CRON_SECRET auth, trigger rules, deduplication, status transitions, overdue review calculation, AI adapter tests, and 14 comprehensive break-glass & audit tests (AES-256-GCM encryption/decryption, NIST 96-bit random nonce uniqueness, short reason rejection, tampering detection, custom key isolation, reason code allow-list, officer assignment, and active grant status/expiry).
  - 17 ml tests — pure deterministic scoring, boundaries, and trigger rules.
- `npm run test:e2e` passes **21/21** (was 19/19): includes checks for Phase 6 migration, routes, and UI components, plus functional smoke tests for encryption, 30m expiry, role gates, clamp to 20 rows, and immutable per-read audit logging.
- `npm run build` succeeds; `/commander`, `/commander/units/[id]`, `/welfare`, `/welfare/audit`, `/welfare/reports/[id]`, `/api/briefings/[unitId]`, `/api/briefings/[unitId]/events`, `/api/briefings/[unitId]/print`, `/api/internal/weekly-run`, `/api/welfare/audit`, `/api/welfare/reports/[id]/access-grants`, `/api/welfare/reports/[id]/individuals`, and all API routes compile as dynamic (ƒ) with `Cache-Control: no-store` enforced.
- **New this phase**:
  - `backend/src/audit.js`: AES-256-GCM authenticated encryption and decryption (`encryptReason`, `decryptReason`) with 96-bit random nonce and auth tag (`v1:<iv>:<tag>:<ciphertext>`). Reason validation (minimum 10 characters, allowed reason codes: `welfare_review`, `roster_audit`, `safety_check`, `leave_rebalancing_assessment`, `emergency_support`) and server-enforced 30-minute expiry (`validateGrantRequest`, `isGrantActive`).
  - `backend/src/config.js`: `getServiceRoleClient` server-only factory helper, keeping all references to service-role keys strictly inside `@unitpulse/backend` and completely away from client bundles (preventing secret scanner failures).
  - SQL migration `supabase/migrations/20260930150000_phase6_break_glass.sql`:
    - Updated `private.access_grants` reason code check constraint.
    - Transactional read function `private.execute_audited_break_glass_read`: rechecks officer role, report assignment, unit consistency, grant validity, and 30-minute auto-expiry atomically; clamps output to maximum 20 pseudonymous records; writes an immutable per-read audit log entry to `private.access_audit`.
    - Revoked ordinary table `SELECT` and direct function execution from client roles (`anon`, `authenticated`, `public`); granted execution strictly to `service_role`.
  - Frontend domain & authorization (`frontend/src/lib/welfare/break-glass.js` & `frontend/src/lib/welfare/authorize.js`):
    - `resolveBreakGlassGrantRequestAccess` and `resolveBreakGlassReadAccess` resolving 401 unauthenticated, 403 commander denial (T-02), 404 unassigned report concealment (T-06), 400 missing grant ID, and 403 expired grant (T-08).
    - `executeIndividualRead` enforcing 20-row maximum clamp and per-read audit generation.
  - Authenticated API Endpoints with `Cache-Control: no-store`:
    - `POST /api/welfare/reports/[id]/access-grants`: validates reason, encrypts justification at rest, creates 30-minute grant.
    - `GET /api/welfare/reports/[id]/individuals`: rechecks assignment and active grant, calls transactional read function, returns max 20 pseudonymous rows.
    - `GET /api/welfare/audit`: returns strictly the calling officer's own audit events.
  - Frontend UI:
    - `frontend/src/app/welfare/reports/[id]/BreakGlassPanel.js`: interactive grant dialog with clear visibility scope disclosure, reason code dropdown, typed justification textarea (min 10 chars), live 30-minute countdown timer, paginated table (20 rows/page), and download/export avoidance notice.
    - Dedicated Officer Audit Viewer at `/welfare/audit/page.js` with header navigation link in `/welfare/page.js`.

| Command | Exit code | Notes |
|---|---|---|
| `npm run lint` | 0 | ESLint clean on frontend; zero-secret lint clean on backend (11 files) & ml (6 files) |
| `npm run test` | 0 | 191 passed (57 frontend, 117 backend, 17 ml) |
| `npm run test:e2e` | 0 | 21/21 passed |
| `npm run build` | 0 | All commander, welfare, briefing, break-glass, and internal API routes compile dynamic (ƒ) |
| `node scripts/verify-phase-6.js` | 0 | 40/40 checks passed; output saved to `tests/results/phase-6-verification-2026-09-30.txt` |

## Independent Phase 6 verification pass (Guidebook verification prompt)
Per: "Attempt all of the following: commander request, unrelated officer, missing reason, altered report ID, altered unit ID, expired grant, revoked grant, direct private-table query, and repeated paginated reads. Verify successful reads each produce an audit row, and failures produce no individual data. Review that the audit reason is encrypted at rest and plaintext is not logged. Report any direct unlogged read path."

- **Commander request (T-02)**: Returns 403 Forbidden on grant request (`role_not_welfare_officer`), individual read, and audit endpoints. Commander cannot obtain individual data; zero grants or audit records are created.
- **Unrelated officer (T-06)**: Returns 404 Not Found (`report_not_assigned_to_user` concealment, preventing existence oracle) on grant request and individual read. Domain logic explicitly rejects unassigned officers.
- **Missing / short / invalid reason (T-07)**:
  - Empty reason string: rejected (min 10 chars required).
  - Short reason ("urgent", 6 chars): rejected with 422.
  - Invalid reason code (`disciplinary_inquiry`): rejected; only permitted codes accepted.
  - No grant created; grant store remains empty.
- **Altered report ID**: Authorization gate returns 404 (`report_not_assigned_to_user`). In domain execution, `executeIndividualRead` throws `grant_mismatch`. Database transactional function verifies `r.unit_id = p_unit_id` and `g.report_id = p_report_id`.
- **Altered unit ID**: Authorization gate returns 403 `unit_mismatch`. Database transactional function strictly verifies `v_grant.unit_id <> v_report.unit_id` and raises an exception.
- **Expired grant (T-08)**: At 31 minutes post-grant, `isGrantActive` returns `false`. Authorization gate returns 403 Forbidden with `grant_expired`. Database transactional function verifies `v_grant.expires_at <= now()`.
- **Revoked grant**: Grant flagged with `is_revoked = true` is evaluated as inactive (`isGrantActive` returns `false`). Authorization returns 403 Forbidden with `grant_revoked`. Database transactional function verifies `v_grant.is_revoked = true` and aborts.
- **Direct private-table query**: Schema `private` privileges explicitly revoked from `public`, `anon`, and `authenticated` roles. Row Level Security enabled on `private.access_grants` and `private.access_audit`. Direct execution of `private.execute_audited_break_glass_read` revoked from client roles and granted exclusively to `service_role`.
- **Repeated paginated reads (T-09)**:
  - Page 1 read (limit 10, offset 0): returns 10 records and atomically inserts 1 audit row with `row_count: 10`, `action: 'individual_read'`.
  - Page 2 read (limit 10, offset 10): returns next 10 records with distinct personnel IDs and appends a 2nd audit row.
  - Request with limit 100: clamped strictly to maximum 20 records; audit row records clamped count (20).
  - Failed reads: throw exceptions and return zero individual data.
- **Reason encrypted at rest & zero plaintext logging**:
  - Ciphertext matches AES-256-GCM authenticated format `v1:<12-byte IV>:<16-byte Tag>:<Ciphertext>`.
  - Plaintext reason is 100% absent from stored ciphertext.
  - Decryption with system key accurately recovers original typed justification.
  - Bit-flipping tampering triggers cryptographic auth tag verification exception.
  - Audit log table stores only `reason_code` (`welfare_review`), never plaintext justification.
- **Direct unlogged read path**: None exists. Audited all route handlers and database routines: exactly one route exists (`/api/welfare/reports/[id]/individuals`), which strictly enforces `executeIndividualRead` and `Cache-Control: no-store`. Database read function atomically records in `private.access_audit` in the same transaction. Audit trail viewer isolates events per officer (Officer B sees 0 events from Officer A).

## What does NOT work / not implemented yet
- **Remote hosted Supabase instance not yet connected.** All database logic runs against unit test mocks or degrades gracefully when env vars are unset.
- Phase 7: Import, hardening, and accessibility (`/admin/import` synthetic-CSV flow, duplicate detection, chart accessibility, performance benchmarks).

## Known issues
- Docker Desktop or Podman is not installed on this host environment. Remote hosted Supabase is preferred by the user to avoid Docker.
- `scripts/seed-demo.js` fabricates weekly metrics directly rather than deriving them via `metrics.js`/`release.js` — unchanged since Phase 2.

## Environment facts the next agent needs
- This host: Node v20.20.2, npm 10.8.2. npm workspaces (`frontend`, `backend`, `ml`). Root `package.json` contains `"type": "module"`.
- Frontend dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `next`, `react`, `react-dom`.
- Real test results: `tests/results/phase-1-2026-09-30.txt`, `phase-2-2026-09-30.txt`, `phase-3-2026-09-30.txt`, `phase-4-2026-09-30.txt`, `phase-5-2026-09-30.txt`, `phase-6-2026-09-30.txt`.

## Decisions made this phase
- D-29: Break-glass grant storage & encryption — AES-256-GCM with NIST 96-bit nonce; 30-minute auto-expiry.
- D-30: Narrow transactional database read function (`private.execute_audited_break_glass_read`) — atomic verification of role, assignment, unit, active grant; max 20 pseudonymous rows; immutable per-read audit row; service-role execution only.
- D-31: Officer audit trail viewer (`/welfare/audit`) & download avoidance — dedicated viewer for officer's own events; strict `Cache-Control: no-store`; zero individual export/download capability.

## Open questions for the human
- Ready to proceed to Phase 7 (Import, hardening, and accessibility) or link remote Supabase project?
