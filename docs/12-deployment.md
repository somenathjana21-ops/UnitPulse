# 12 — Deployment and DevOps

## Environments

| Environment | Data | Purpose | Verification Status |
|---|---|---|---|
| Local | Synthetic | Feature engineering, unit/integration testing | Fully verified (230 tests passing) |
| Preview | Synthetic | Team review, PR verification on Vercel | Verified via `vercel.json` and preview configuration |
| Public demo | Synthetic only | Smart India Hackathon (SIH 26186) judging | Verified with fictional units (UNIT-A through UNIT-F) |
| Future approved deployment | To be determined by sponsor | Requires separate security/legal/hosting approval | Out of scope for prototype |

---

## Environment Variable Checklist

All secrets must be managed strictly according to least-privilege principles. Only public Supabase credentials may be exposed to the browser. All other credentials must remain server-side.

### 1. Client-Side Variables (Browser Accessible)

These variables are prefixed with `NEXT_PUBLIC_` and are bundled into client JavaScript. They must NEVER contain service role keys, master secrets, or encryption keys.

| Variable Name | Required | Example / Format | Description & Security Guard |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://xyzcompany.supabase.co` | Public Supabase project URL for Auth and client-side RLS queries. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `sb_publishable_...` or JWT | Supabase anonymous public API key. Access is gated strictly by PostgreSQL Row-Level Security (RLS). |

### 2. Server-Side Variables (Strictly Server-Only)

> [!CAUTION]
> **NEVER** prefix the following variables with `NEXT_PUBLIC_`. If prefixed with `NEXT_PUBLIC_`, they will be exposed in client bundles and cause immediate security release disqualification.

| Variable Name | Required | Example / Format | Purpose & Server Scope |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `sb_secret_...` or JWT | Elevated key for server-side background worker, transactional audit logging, and seed execution. Bypasses RLS. NEVER exposed to browser. |
| `CRON_SECRET` | Yes | 64-char hex string (`openssl rand -hex 32`) | Bearer token required to trigger `/api/internal/weekly-run`. Verified by server handler on every invocation. |
| `APP_ENCRYPTION_KEY_BASE64` | Yes | 32-byte base64 string (`openssl rand -base64 32`) | AES-256-GCM symmetric key for encrypting officer break-glass justifications at rest. Plaintext reasons never logged. |
| `NO_LLM_MODE` | Optional (default: `true`) | `true` or `false` | When `true`, enables deterministic fallback briefing templates without requiring an external LLM API key. |
| `AI_BASE_URL` | If LLM enabled | `https://api.openai.com/v1` or `https://integrate.api.nvidia.com/v1` | Server-only base URL for OpenAI-compatible or Nemotron model provider. |
| `AI_API_KEY` | If LLM enabled | `sk-...` or `nvapi-...` | Provider authentication API key. Stays strictly server-side in route handlers. |
| `AI_MODEL` | If LLM enabled | `gpt-4o-mini` or `nemotron-3-ultra-550b-a55b` | Target model identifier. |
| `AI_JSON_MODE` | Optional (default: `false`) | `true` or `false` | Instructs adapter whether provider natively supports JSON mode response formats. Auto-retries without if 400. |
| `AI_TIMEOUT_MS` | Optional (default: `10000`) | `10000` (10s) | Server-side abort timeout before falling back to deterministic safe explanations. |
| `RELEASE_EPSILON_PER_COUNT` | Optional (default: `0.2`) | `0.2` | Differential privacy Laplace noise scale for public unit counts. |
| `APP_DATA_MODE` | Yes | `synthetic` | Enforces synthetic safety checks across ingestion and reporting pipelines. |

---

## Local Setup Contract

1. **Prerequisites**: Install supported Node.js LTS (v20+) and npm (v10+).
2. **Install dependencies**: Run from the repository root:
   ```bash
   npm install
   ```
3. **Database Setup**:
   - For local Supabase CLI: `npx supabase start`
   - Apply migrations: `npx supabase db reset` (or run migrations in `supabase/migrations/` sequentially).
   - Seed synthetic dataset: `npm run seed:demo`
4. **Environment File**:
   - Copy `.env.example` to `frontend/.env.local`.
   - Populate with local Supabase keys or set `NO_LLM_MODE=true` for local deterministic execution.
5. **Verify Build & Tests**:
   ```bash
   npm run lint
   npm run test
   npm run test:e2e
   npm run build
   ```
6. **Start Application**:
   ```bash
   npm run dev
   ```

---

## Vercel Preview & Production Deployment

### 1. Monorepo Configuration
The repository is structured with npm workspaces (`frontend/`, `backend/`, `ml/`). Vercel deployment is configured via `vercel.json` in the project root:
- **Build Command**: `npm run build`
- **Install Command**: `npm install`
- **Framework**: `nextjs`
- **Root Directory**: `.` (Root repository to preserve workspace resolution) or set to `frontend` with workspace root linking.

### 2. Environment Variables in Vercel Dashboard
In the Vercel Project Settings &rarr; **Environment Variables**, configure:
1. `NEXT_PUBLIC_SUPABASE_URL`: Public Supabase Project URL.
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public Anon Key.
3. `SUPABASE_SERVICE_ROLE_KEY`: Service role secret (Server-only).
4. `CRON_SECRET`: Random 64-char hex string (Server-only).
5. `APP_ENCRYPTION_KEY_BASE64`: Random 32-byte base64 string (Server-only).
6. `NO_LLM_MODE`: Set to `true` for pure deterministic zero-cost demo, or `false` with NVIDIA/OpenAI credentials.
7. `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`: Model credentials (Server-only).
8. `APP_DATA_MODE`: Set to `synthetic`.

### 3. Vercel Cron Job Configuration
Configured automatically in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/internal/weekly-run",
      "schedule": "0 2 * * 1"
    }
  ]
}
```
Vercel invokes `/api/internal/weekly-run` every Monday at 02:00 UTC. The route handler checks `Authorization: Bearer <CRON_SECRET>` before executing the weekly release pipeline.

### 4. Security & HTTP Header Enforcement
All sensitive and role-specific endpoints return `Cache-Control: no-store` to prevent caching of aggregate welfare analytics or break-glass access grants:
```text
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

---

## Remote Supabase Deployment & Verification

When provisioning a hosted Supabase project:
1. **Region Alignment**: Select a cloud region geographically closest to the Vercel function region (e.g. `ap-south-1` Mumbai / `iad1` Washington DC) to minimize round-trip database latency.
2. **Apply Migrations in Sequential Order**:
   - `20260930120000_phase1_initial_schema.sql` (Schema, roles, RLS policies, break-glass functions)
   - `20260930140000_phase5_briefings.sql` (Briefing storage and print format support)
   - `20260930150000_phase6_break_glass.sql` (Break-glass AES encryption and audited read procedure)
   - `20260930160000_phase7_import_and_hardening.sql` (CSV import procedure and integrity indexes)
3. **Execute Synthetic Seed**:
   - Run `node scripts/seed-demo.js` to generate `supabase/seed.sql`.
   - Execute `supabase/seed.sql` via Supabase SQL Editor.
4. **Verify Synthetic Integrity**:
   - Confirm only units `UNIT-A` through `UNIT-F` exist.
   - Confirm only synthetic emails `@synthetic.unitpulse.local` exist.
   - Confirm zero real personnel, units, or locations exist in any table.

---

## Continuous Integration & Release Gates

Before promoting any build to preview or demo:
- [x] **Zero Secret Leakage**: No `NEXT_PUBLIC_` prefixes on server keys; no keys in Git history.
- [x] **Strict Role Boundaries**: Commander cannot see personnel IDs or individual records; unauthenticated requests receive 401; cross-unit tampering receives 404.
- [x] **Differential Privacy**: Groups <5 are fully suppressed; Laplace noise applied to counts once per release.
- [x] **Audited Break-Glass**: Individual records accessible only via 30-minute time-limited grant with encrypted justification and immutable audit log.
- [x] **AI Resilience**: System operates reliably in `NO_LLM_MODE=true` or during AI provider outages.
- [x] **Build & Tests**: `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build` pass with exit code 0.

---

## Operational Caution & Ethical Boundaries

Unit Pulse 2.0 is an academic and hackathon prototype developed for Smart India Hackathon Problem Statement 26186.

1. **Synthetic Data Only**: The platform is demonstrated using 100% synthetic fictional data (`UNIT-A` through `UNIT-F`).
2. **Non-Clinical Indicator**: The Unit Load & Recovery Index is an operational welfare planning measure. It is NOT a clinical diagnosis, psychological assessment, or fitness determination.
3. **Non-Punitive Mandate**: Metrics must never be used for disciplinary action, performance appraisals, deployment penalties, or career gatekeeping.
4. **Sponsor Pilot Requirement**: Do NOT connect this prototype to live armed force or police personnel databases without separate legal, operational, security accreditation, and ethical governance reviews with authorized authorities.