# Unit Pulse 2.0

**Aggregate-first welfare intelligence for uniformed services — synthetic-data prototype.**

Unit Pulse shows possible **unit-level workload and recovery concerns** from leave and duty patterns. It provides simple, evidence-linked suggestions and routes elevated unit conditions to an assigned welfare officer. It does not diagnose personnel or support disciplinary decisions.

## Status

SIH Problem Statement 26186 prototype. **No real personnel, operational, or deployment data is permitted in this public-demo environment.**

## Roles & Portals

- **Commander** (`/commander`, `/commander/units/:id`): Approved aggregate unit cards, rolling baseline trends, possible contributing conditions, and non-disciplinary supportive actions. Zero personnel identifiers or raw rows.
- **Welfare Officer** (`/welfare`, `/welfare/reports/:id`, `/welfare/audit`): Assigned unit welfare reports, follow-up workflow milestones, exceptional reasoned 30-minute break-glass individual access with mandatory per-read audit logging, and dedicated officer audit trail.
- **HR Uploader** (`/admin/import`): Restricted synthetic-CSV ingestion with strict 2MB size limit, schema and calendar date validation (rejects invalid dates like 2026-02-31), duty bounds (0-24 hrs), formula injection defense, duplicate detection, overlapping leave rejection, atomic transactional rollback, and safe error summaries (zero raw row logging). No generic database admin browser is provided.
- **SIH Evaluator / Presentation Deck** (`/presentation`): Interactive official 6-slide Smart India Hackathon presentation deck with presenter notes, empirical demo fixture figures, and 1-click `@media print` landscape export to PDF.

## Repository Guide

- `Project_Brief.md`: Start here.
- `docs/`: Product, architecture, security, data specifications, test plans, and decision log.
- `docs/sih-presentation-deck.md`: 6-slide official SIH presentation deck documentation.
- `docs/two-minute-demo.md`: Verbatim 2-minute walkthrough script with displayed empirical figures.
- `docs/12-deployment.md`: Complete Vercel preview deployment guide & environment variable checklist.
- `Guidebook.md`: Phase-by-phase coding-agent prompts and verification gates.
- `frontend/`: Next.js 14 App Router (JavaScript).
- `backend/`: Server-only domain workflows, permissions, and ingestion logic.
- `ml/`: Deterministic index, rolling baseline, and trigger rules.
- `supabase/migrations/`: Database schema, private schema isolation, and access policies.

## Verified Local Commands

These commands are implemented, tested, and actively verified in this repository:

```bash
# 1. Install dependencies across all npm workspaces
npm install

# 2. Run static analysis and zero-secret linters across frontend, backend, and ml
npm run lint

# 3. Run unit and domain integration test suites (230 tests passing)
npm run test

# 4. Run end-to-end security and functional verification suite (25 checks passing)
npm run test:e2e

# 5. Compile production Next.js build (dynamic routes + no-store caching)
npm run build

# 6. Generate synthetic seed dataset (6 fictional units, 360 personnel, 180 days)
npm run seed:demo

# 7. Start local development server
npm run dev

# 8. Measure real performance benchmarks (dashboard response, weekly job, AI fallback, CSV throughput)
node scripts/measure-performance.js

# 9. Run Phase 7 ingestion hardening audit (formula injection, malformed CSV, size limits, bad dates, duplicates)
node scripts/verify-phase-7.js

# 10. Run comprehensive Phase 8 release audit across all 12 criteria (12/12 PASS)
node scripts/verify-phase-8-release.js
```

*Note on Supabase Local Development:*
- `npx supabase db reset` and `npx supabase start` require local Docker Desktop. When running in environments without Docker, the platform runs against unit test mocks or connects to a remote hosted Supabase instance via `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## AI Setup & Outage Resilience

The system works seamlessly in `NO_LLM_MODE=true` using deterministic, evidence-grounded explanations. To enable an approved OpenAI-compatible provider, configure server-only `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`, and capability flag `AI_JSON_MODE`. Provider credentials are strictly server-only and are never exposed to the browser. In the event of a provider timeout or outage, the platform automatically falls back to deterministic safe explanations.

## Privacy & Safety Limitations

A five-person group threshold, coarsened metrics, and Laplace noise on selected counts reduce—but do not eliminate—re-identification risk. This prototype is an operational welfare planning indicator; it is **not** certified as clinically predictive, formally anonymous, or approved for real uniformed-force records.

## License

Repository-authored code may be distributed under `LICENSE`. Third-party logos, SIH templates, external datasets, and organizational data are not covered by that code license.