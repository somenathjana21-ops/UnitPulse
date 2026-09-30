# Guidebook — Building Unit Pulse 2.0 With a Coding Agent

## How to use this guide

1. Put all supplied documentation into the repository first.
2. Start the agent at the `project/` root.
3. Paste one **Implementation prompt**.
4. Require the agent to list files changed and commands actually run.
5. Paste the matching **Verification prompt**.
6. Perform the **Manual verification** yourself.
7. Fix failures before the next phase.

The agent must not claim that tests passed if it could not run them. It must not use real uniformed-force data, insert secrets into source control, remove a privacy requirement to make a demo work, or describe a unit index as a clinical stress diagnosis.

---

## Phase 0 — Scaffold and environment

### Implementation prompt

```text
Read Project_Brief.md, docs/02-prd.md, docs/05-system-architecture.md,
docs/10-security-privacy.md, and docs/15-decision-log.md.

Create the monorepo scaffold with npm workspaces for frontend/ (Next.js
App Router, JavaScript), backend/ (server-only domain logic), and ml/
(deterministic analytics). Add root package.json scripts for dev, lint,
test, test:e2e, build, and seed:demo. Add a basic public explanation page
and /login page. Add .gitignore protecting *.env.local and secrets.
Use only synthetic-demo wording. Do not implement fake authentication
or a client-visible service key. Make a clear TODO list for unfinished
features instead of pretending they already exist.

Run install, lint, and build if the environment permits. Report exact
results and files created.
```

### Verification prompt

```text
Audit Phase 0 against the requested documents. Search for NEXT_PUBLIC_
on service-role, AI, cron, and encryption secrets. Confirm the workspace
build resolves frontend/backend/ml imports. Report the exact commands run,
their exit codes, missing tools, and any unimplemented requirements.
Do not fix errors by weakening security language.
```

### Manual verification

- [ ] `npm install` succeeds.
- [ ] `npm run build` succeeds or the agent explains the exact blocking dependency.
- [ ] `.env.local` is Git-ignored.
- [ ] Public page says **synthetic demo** and **not a diagnosis**.
- [ ] No hardcoded provider or Supabase service key appears in client code.

---

## Phase 1 — Schema, roles, and synthetic seed

### Implementation prompt

```text
Read docs/03-srs.md, docs/06-data-specification.md,
docs/09-database-design.md, and docs/10-security-privacy.md.

Create Supabase SQL migrations for private source tables, protected
public release/report tables, user_roles, and unit_assignments.
Enable RLS on every client-facing table. Keep raw personnel, leave,
duty, and deployment records in a schema not exposed to browser clients.
Do not attempt to put RLS on a materialized view. Create constraints,
indexes, and a narrow role-provisioning process.

Create a synthetic seed generator: six fictional units, 60 synthetic
people each, about 180 days of records, 12 completed usable weekly
snapshots. Include one elevated and one stable unit. Do not use real
names, actual forces, or real locations. Add permission tests showing
anonymous and commander users cannot read raw rows or another unit.

Run local migration/seed/tests if Supabase CLI is available. State exactly
what you verified.
```

### Verification prompt

```text
Act as a hostile user. Review SQL grants, exposed schemas, RLS policies,
role self-assignment, and direct PostgREST access. Look specifically for
service_role misuse in ordinary user requests and SELECT on private
personnel records. List any path by which commander or anonymous users
could obtain person-level data. Show test evidence; do not assume RLS
works just because it is enabled.
```

### Manual verification

- [ ] `npx supabase db reset` runs locally.
- [ ] `npm run seed:demo` produces fictional-only data.
- [ ] Commander credentials cannot query private raw tables.
- [ ] Changing a unit ID does not reveal another unit's release.
- [ ] A user cannot edit their own role or unit assignment.

---

## Phase 2 — Metrics, index, baseline, and privacy release

### Implementation prompt

```text
Read docs/06-data-specification.md, docs/07-ml-specification.md,
docs/10-security-privacy.md, and docs/11-testing-plan.md.

Implement weekly verified-source metrics in backend/, and pure,
well-tested score/baseline/trigger functions in ml/. Use the exact
windows and thresholds from the specifications. Omit the denial
feature and normalize when its request volume is insufficient; compare
baselines only for matching score version and feature mask. Never
replace missing data with zero.

Create a private-to-public release job. Before release, suppress groups
under five and sensitive cells/complements under five. Add cryptographically
sampled Laplace noise to selected bounded 0/1 person counts exactly
once per unit/week, then persist the released values. Do not resample
on page reads; do not claim system-wide differential privacy. Add test
fixtures for group size four, group size five with a one-person breakout,
missing data, stable re-fetches, baseline boundaries, and a triggered unit.

Report expected and actual fixture outputs.
```

### Verification prompt

```text
Independently inspect every denominator and time window: 90-day leave,
28-day night duty, 7-day hours, recovery gap >60 days, and prior-only
baseline. Test score-boundary values, an absent/zero denominator,
one-person sensitive cell, and repeated release GETs. Check that an API
response cannot contain hidden exact metrics even when the UI suppresses
them. Identify any formal-privacy claim the implementation cannot support.
```

### Manual verification

- [ ] A four-person unit shows no hidden figures.
- [ ] A revealing one-person breakout remains hidden even in a larger unit.
- [ ] Reloading the same weekly view returns the same approximate numbers.
- [ ] Missing records show “insufficient data,” never “0 risk.”
- [ ] Index and baseline come from code, not the LLM.

---

## Phase 3 — Commander dashboard and walkthrough

### Implementation prompt

```text
Read docs/02-prd.md, docs/04-user-flows.md, docs/05-system-architecture.md,
and docs/08-api-specification.md.

Build /commander and /commander/units/[id] in Next.js. Use only approved
unit_week_releases reached through authenticated, unit-scoped server routes.
Add a unit-card grid, accessible trend visualization, leave/recovery and
night-duty indicators, evidence/action cards, clear suppression and
missing-data states, and an 'How this works' explanation. Use a fictional
unit grid, not operational geolocation. No commander UI/API may receive
personnel IDs or individual rows. Use no-store on protected routes.

Provide a short first-time walkthrough: See Unit Health → Understand
Possible Contributors → Consider Supportive Actions. Add tests for
cross-unit URL changes and hidden data in JSON responses.
```

### Verification prompt

```text
Inspect both HTML and network responses for names, person IDs, raw metrics,
hidden small-group counts, location details, and private case notes.
Verify keyboard interaction and text alternatives for chart colors.
Check cache headers and confirm a role-specific page is not statically
cached or shared between users. Report browser tests actually run.
```

### Manual verification

- [ ] Log in as commander and see only assigned units.
- [ ] Open browser DevTools → Network; no person-level payload appears.
- [ ] Open another unit's guessed URL; it is denied.
- [ ] Use keyboard only to navigate the unit cards.
- [ ] The page says “possible contributing conditions,” not “diagnosed stress.”

---

## Phase 4 — Weekly report and welfare workflow

### Implementation prompt

```text
Read docs/03-srs.md, docs/07-ml-specification.md, docs/08-api-specification.md,
docs/09-database-design.md, and docs/11-testing-plan.md.

Implement the protected, idempotent completed-week worker. Compare
internal scores with comparable prior baselines. Trigger a report when
(current >=40 and current >= baseline+15 with >=4 earlier comparable
weeks) OR (current >=75 for two consecutive completed weeks). Maintain
at most one active report per unit and handle retries/concurrency with
database constraints. Create an assigned welfare inbox and report detail
with statuses new, acknowledged, action_taken, follow_up, closed.
Only the assigned welfare officer may access or update the report.

Add the protected Vercel Cron GET route; check CRON_SECRET server-side.
Do not send case details by email in the MVP. Show in-app notification
and an overdue-review indicator.
```

### Verification prompt

```text
Run the completed-week job twice and, if feasible, concurrently. Count
releases and reports. Verify a prior-only baseline, sustained-high case,
missing baseline case, and officer assignment checks. Attempt report GET
and PATCH as commander, unrelated officer, and anonymous user. Provide
the observed HTTP statuses and database row counts.
```

### Manual verification

- [ ] The elevated synthetic unit creates one assigned report.
- [ ] Re-running the job creates no duplicate active report.
- [ ] An unrelated welfare officer cannot open it.
- [ ] Commander view contains no confidential welfare case notes.
- [ ] Status transitions require the proper officer.

---

## Phase 5 — AI adapter and briefing

### Implementation prompt

```text
Read docs/07-ml-specification.md, docs/08-api-specification.md, and
docs/10-security-privacy.md.

Build one server-only OpenAI-compatible provider adapter configured by
AI_BASE_URL, AI_API_KEY, AI_MODEL, AI_JSON_MODE, and timeout. Some providers
do not support identical JSON or streaming modes: handle capability
differences rather than assuming compatibility. In NO_LLM_MODE or on
failure, produce deterministic approved explanations.

Give the model only the privacy-released aggregate snapshot and allowed
evidence/action codes. Validate returned structured data. Assemble final
displayed numbers server-side from approved values; reject invented
metrics, diagnoses, punitive suggestions, and unsupported causal claims.
Store a weekly aggregate briefing. Build a print-friendly aggregate-only
page for browser Save as PDF. If adding SSE, stream only validated stored
sections—not unvalidated raw model tokens.

Add adversarial and provider-outage tests. Never put the AI key in the
browser or log request payloads containing restricted data.
```

### Verification prompt

```text
Mock the provider returning: invalid JSON, an invented percentage, a
diagnosis, a punitive action, a timeout, and HTTP 429. For each, confirm
deterministic safe fallback. Inspect the outbound provider request for
person IDs, raw rows, exact locations, typed welfare reasons, and hidden
suppressed figures. Confirm switching provider settings needs no UI or
score-code change.
```

### Manual verification

- [ ] With `NO_LLM_MODE=true`, the workflow still produces a briefing.
- [ ] AI wording says “may” or “consider,” not “caused” or “diagnosed.”
- [ ] The print page contains aggregates only.
- [ ] Print → Save as PDF creates a readable file.
- [ ] No AI request fires from browser JavaScript.

---

## Phase 6 — Break-glass access and audit

### Implementation prompt

```text
Read docs/04-user-flows.md, docs/08-api-specification.md,
docs/09-database-design.md, docs/10-security-privacy.md, and
docs/11-testing-plan.md.

Implement the exceptional individual-read workflow. Require an assigned
welfare report, a reason code plus typed reason, server-enforced
30-minute grant, and server-side encryption of the stored reason.
Create a narrow transactional database read function that rechecks
officer/report/unit/grant/expiry, writes an audit event, and returns at
most 20 pseudonymous records. Do not grant ordinary client SELECT on
private records. Expose an officer audit viewer for the officer's own
events. Apply no-store and avoid download/export of individual rows.

If using service-role credentials in a narrow route, authenticate the
user first, recheck assignment inside the database function, and never
expose those credentials to the browser.
```

### Verification prompt

```text
Attempt all of the following: commander request, unrelated officer,
missing reason, altered report ID, altered unit ID, expired grant,
revoked grant, direct private-table query, and repeated paginated reads.
Verify successful reads each produce an audit row, and failures produce
no individual data. Review that the audit reason is encrypted at rest
and plaintext is not logged. Report any direct unlogged read path.
```

### Manual verification

- [ ] Grant dialog states exactly what can be seen and for how long.
- [ ] No typed reason means no grant.
- [ ] After expiry, refresh the page: individual access fails.
- [ ] Officer audit view records who/when/which report/action.
- [ ] Commander cannot obtain the same data by calling an API directly.

---

## Phase 7 — Import, hardening, and accessibility

### Implementation prompt

```text
Read docs/06-data-specification.md, docs/10-security-privacy.md,
docs/11-testing-plan.md, and docs/14-risk-register.md.

Implement the restricted /admin/import synthetic-CSV flow with size
limits, schema and relationship validation, duplicate detection,
transactional import, safe error summaries, and no raw row logging.
Do not provide a generic database admin browser. Run lint, unit,
database integration, API, and browser tests. Add accessible chart
summaries, meaningful loading/empty/error states, and measured
performance results for the demo fixture. Fix release-blocking issues
before cosmetic work. Update README to match commands that actually run.
```

### Verification prompt

```text
Review the implementation against every release-blocking failure in
docs/11-testing-plan.md and every critical risk in docs/14-risk-register.md.
Try malformed CSV, CSV formula injection, a >size-limit upload, duplicate
leave rows, bad dates, unauthorized imports, and an AI outage. Include
actual test command output, failures, remaining limitations, and files
changed. Do not mark a requirement done without evidence.
```

### Manual verification

- [ ] Wrong-role import is rejected.
- [ ] Bad CSV does not create partially accepted hidden records.
- [ ] `npm run lint`, `npm run test`, and `npm run build` pass.
- [ ] Any failing RLS or audit test blocks further deployment.
- [ ] README instructions work from a clean checkout.

---

## Phase 8 — Deployment and final demo

### Implementation prompt

```text
Read docs/12-deployment.md, docs/13-project-roadmap.md,
docs/14-risk-register.md, and Project_Brief.md.

Prepare synthetic-only Vercel preview deployment documentation and
environment-variable checklist. Keep service, cron, AI, and encryption
keys server-side. Verify the configured Supabase environment contains
synthetic records only. Confirm role-specific responses are no-store
and production build passes. Prepare a two-minute demo using actual
application screenshots and actual displayed numbers. Record known
limitations honestly. Do not upload real personnel records, publish
demo credentials for real systems, or claim the platform is approved
for operational force data.
```

### Verification prompt

```text
Perform a release audit: secrets, Git history, environment settings,
synthetic-only dataset, role boundaries, small-group suppression,
report idempotency, audited reads, AI fallback, print-to-PDF, build,
and cross-role browser tests. For each item state PASS, FAIL, or NOT
VERIFIED with evidence. Block release for critical FAIL or NOT VERIFIED.
```

### Manual verification

- [ ] Public URL contains no real force identifiers or records.
- [ ] Both commander and welfare walkthroughs work.
- [ ] Suppressed data is absent from API responses, not only hidden in CSS.
- [ ] Alert, officer acknowledgement, break-glass expiry, and audit work.
- [ ] Final slide numbers match real synthetic-demo screenshots.
- [ ] SIH deck contains six slides and is exported as PDF.

---

## Final two-minute walkthrough

1. “These are six fictional units. Commanders see aggregates, never personnel.”
2. “This unit's load-and-recovery index rose above its own earlier baseline.”
3. “The briefing points to approved leave and night-duty indicators, then suggests small actions to review.”
4. “The trigger created one confidential assigned welfare report.”
5. “The officer can follow up; individual records require a typed reason, a 30-minute grant, and a logged read.”
6. “The AI provider can be switched, but score calculation and privacy rules do not depend on the AI.”
7. “This is a synthetic prototype, not a clinical diagnostic or approved live-force deployment.”