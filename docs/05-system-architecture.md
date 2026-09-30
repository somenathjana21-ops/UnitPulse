# 05 — System Architecture

## Architecture overview

```text
Browser
  │ authenticated HTTPS
  ▼
Next.js on Vercel
  ├─ Role-specific pages and thin API routes
  ├─ backend/ server-only orchestration
  └─ OpenAI-compatible provider adapter
              │ aggregate-only payloads
              ▼
         AI provider or fallback

Next.js / weekly server job
  │
  ▼
Supabase PostgreSQL
  ├─ private schema: raw synthetic HR records, internal scores,
  │                  grant and full audit data
  ├─ public RLS tables: approved weekly releases and assigned reports
  └─ Supabase Auth: authenticated user identity
```

## Trust boundaries

1. Browser is untrusted. It never receives provider keys, service-role keys, raw HR tables, or hidden metrics.
2. User-facing server routes authenticate and enforce role and unit scope.
3. Supabase RLS is a second guard on **published** tables.
4. Raw tables and any materialized views reside in a schema not exposed through client-facing PostgREST.
5. Server-only weekly worker calculates exact metrics, applies privacy policy, and inserts approved releases.
6. The AI provider receives only the already-approved aggregate snapshot and allowable evidence keys.

## Weekly processing sequence

```text
Authorized source records
  → validation and coverage checks
  → exact private metrics
  → index + comparable baseline
  → deterministic trigger
  → group/small-cell privacy checks
  → stable noisy public release
  → assigned report if triggered
  → validated AI briefing or fallback
```

Publish the release and associated report together as an idempotent process. If processing fails, do not expose a partly updated week.

## Database access design

Do **not** rely on RLS on a PostgreSQL materialized view. A private materialized view or private metrics table may accelerate calculations, but commander-facing data is copied to `public.unit_week_releases`, which has RLS and limited grants.

`public.welfare_reports` contains an aggregate snapshot and is visible only to its assigned officer. Private person-level tables are never selectable directly by browser users.

## Individual access exception

`POST` to a Next.js break-glass route verifies the user and assigned report, validates a typed reason, encrypts the free-text reason server-side, and invokes a narrow database function to create a scoped grant.

Individual reads go through a separate narrow function that rechecks role, report, unit, and expiry, inserts an audit event **in the same database transaction**, and returns a limited page of pseudonymous work-and-leave records. No direct raw-table query path is permitted.

## Performance design

- Generate one completed-week release per unit; do not aggregate raw rows during page requests.
- Index releases by `(unit_id, week_start)`.
- Use Next.js Server Components for the page shell and small client chart components.
- Do **not** use public CDN/ISR caching for role-specific pages.
- Loading skeletons protect UX while a stored briefing is retrieved or regenerated.
- Choose a deployment region near the approved database region when supported; benchmark rather than promising a fixed latency.

## Mobile future

The same authenticated APIs and role rules can serve a future mobile client. A mobile interface must not gain new privileges by bypassing Next.js or calling raw database tables.