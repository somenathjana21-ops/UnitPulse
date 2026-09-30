# Handoff — Phase 6: Break-Glass Access and Audit

**Written by:** Antigravity on 2026-09-30
**Git tag:** `phase-6-complete`
**Status:** Phase 6 Complete, Agent-Verified. Manual/human review pending live Supabase connection.

## Summary (3 lines max)
Implemented the exceptional individual-read break-glass workflow requiring an assigned welfare report, reason code, and minimum 10-character typed justification stored with server-side AES-256-GCM encryption.
Created narrow transactional database read function `private.execute_audited_break_glass_read` that rechecks officer role, report assignment, unit consistency, grant validity, and 30-minute auto-expiry in one atomic transaction, clamps output to max 20 pseudonymous records, and writes an immutable per-read audit log entry.
Built the interactive `BreakGlassPanel` UI on report detail pages, the Officer Audit Viewer at `/welfare/audit`, and secured routes with `Cache-Control: no-store` while prohibiting bulk row download/export.

## Files created / changed
- `backend/src/audit.js` — AES-256-GCM encryption and decryption (`encryptReason`, `decryptReason`) with NIST-recommended 96-bit random nonce and auth tag; grant validation with 30-minute expiry; expanded reason codes.
- `backend/src/config.js` — added `getServiceRoleClient` server-only factory helper, keeping all references to service-role keys strictly inside `backend/` and away from client bundles.
- `backend/tests/break-glass.test.js` — 14 comprehensive tests covering encryption/decryption, nonce uniqueness, short reason rejection, tampering detection, custom key isolation, reason code allow-list, officer assignment, and active grant status/expiry.
- `supabase/migrations/20260930150000_phase6_break_glass.sql` — SQL migration defining `private.create_access_grant`, `private.execute_audited_break_glass_read`, and `private.get_officer_audit_log`, revoking direct execution and ordinary table SELECT from client roles.
- `frontend/src/lib/welfare/break-glass.js` — domain repository for creating reasoned grants, retrieving grant remaining minutes, executing audited individual reads (clamped to 20 records), and fetching officer-specific audit trails with fallback test stores.
- `frontend/src/lib/welfare/authorize.js` — added `resolveBreakGlassGrantRequestAccess` and `resolveBreakGlassReadAccess` resolving 401 unauthenticated, 403 commander denial (T-02), 404 unassigned report concealment (T-06), 400 missing grant ID, and 403 expired grant (T-08).
- `frontend/src/app/api/welfare/reports/[id]/access-grants/route.js` — authenticated POST route enforcing report assignment, reason validation, AES-256-GCM encrypted storage, and 30-min grant creation with `Cache-Control: no-store`.
- `frontend/src/app/api/welfare/reports/[id]/individuals/route.js` — authenticated GET route enforcing officer assignment and active grant validity, invoking transactional read function, and returning max 20 pseudonymous records with `Cache-Control: no-store`.
- `frontend/src/app/api/welfare/audit/route.js` — authenticated GET route returning only the calling officer's own audit events with `Cache-Control: no-store`.
- `frontend/src/app/welfare/reports/[id]/BreakGlassPanel.js` — client component with grant request form (reason code select + justification textarea), active 30-minute countdown timer, paginated table (max 20 rows/page), and download/export avoidance notice.
- `frontend/src/app/welfare/reports/[id]/page.js` — rendered `BreakGlassPanel` in place of static notice and added audit trail navigation link.
- `frontend/src/app/welfare/audit/page.js` — officer audit trail viewer displaying immutable audit history (who/when/which report/action/row count/reason).
- `frontend/src/app/welfare/page.js` — added header button linking to `/welfare/audit`.
- `frontend/tests/break-glass.test.js` — 12 tests covering T-02 (commander denial), T-06 (unassigned officer 404 concealment), T-07 (short reason 422), T-08 (expired grant 403), T-09 (clamped 20 rows + audit event), and officer audit log isolation.
- `scripts/test-e2e.js` — added checks 19 and 20 for Phase 6 file existence and functional smoke testing (21/21 checks passing).
- `TODO.md` — Phase 6 marked complete and release gate checklist verified.
- `docs/15-decision-log.md` — recorded D-29 (break-glass grant storage & encryption), D-30 (transactional read function with atomic per-read audit), D-31 (officer audit viewer & download avoidance).
- `docs/STATUS.md` — updated phase table and test counts.

## Commands run and results
| Command | Exit code | Notes |
|---|---|---|
| `npm run lint` | 0 | Clean across frontend, backend (11 files), and ml (6 files) |
| `npm run test` | 0 | 191 passed (57 frontend, 117 backend, 17 ml) |
| `npm run test:e2e` | 0 | 21/21 passed |
| `npm run build` | 0 | All commander, welfare, briefing, break-glass, and internal API routes compile dynamic (ƒ) |

## Exit-gate checklist (from Guidebook Phase 6)
- [x] Grant dialog states exactly what can be seen and for how long — verified in `BreakGlassPanel.js` disclosure and 30-minute duration notice.
- [x] No typed reason means no grant — verified via `backend/tests/break-glass.test.js` and `frontend/tests/break-glass.test.js` (rejection of empty/<10 char reasons).
- [x] After expiry, refresh the page: individual access fails — verified via `resolveBreakGlassReadAccess` and route handler test (returns 403 `grant_expired`).
- [x] Officer audit view records who/when/which report/action — verified at `/welfare/audit` and in tests.
- [x] Commander cannot obtain the same data by calling an API directly — verified via T-02 tests (403 forbidden for commanders on `/individuals`, `/access-grants`, and `/audit`).

## Deviations from spec
None. Implementation strictly complies with `docs/04-user-flows.md`, `docs/08-api-specification.md`, `docs/09-database-design.md`, `docs/10-security-privacy.md`, and `docs/11-testing-plan.md`. Decisions D-29, D-30, and D-31 recorded in `docs/15-decision-log.md`.

## Traps for the next agent
1. **Zero Client SELECT on Private Schema**: Browser clients must NEVER be granted direct SELECT on `private.personnel`, `private.access_grants`, or `private.access_audit`. All individual reads must flow through `private.execute_audited_break_glass_read`.
2. **Server-Side Encryption**: Justifications must always be encrypted with `encryptReason` before storage in `private.access_grants.encrypted_reason`. Plaintext reasons must never be logged in error messages or standard output.
3. **No Direct Secret in Frontend**: `SUPABASE_SERVICE_ROLE_KEY` must never be mentioned or imported in `frontend/src/`. All service-role instantiation happens via `getServiceRoleClient` exported from `@unitpulse/backend`.
4. **No Bulk Export / Download**: Per `docs/10-security-privacy.md`, do not add CSV export, JSON download, or browser-cacheable views for individual-level records.

## Exact next step
"Run Phase 7 implementation prompt from Guidebook.md (Import, hardening, and accessibility) — implement restricted `/admin/import` synthetic-CSV flow with size limits, schema/relationship validation, duplicate detection, transactional import, safe error summaries, accessible chart summaries, and measured performance results."
