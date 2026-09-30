# 09 — Database Design

## Schema boundary

```text
private schema — not client-exposed:
  units
  personnel
  leave_eligibility
  leave_records
  duty_records
  deployments
  unit_week_metrics
  access_grants
  access_audit

public schema — RLS enabled:
  user_roles
  unit_assignments
  unit_week_releases
  welfare_reports
```

“Public schema” here is a PostgreSQL schema name, **not** permission for anonymous public access.

## Core relationships

- One `unit` has many `personnel`.
- Source rows reference pseudonymous `personnel.id`.
- One `(unit_id, week_start, score_version)` identifies a calculated internal week.
- One `(unit_id, week_start)` identifies a published privacy-checked release.
- A welfare report references a unit/week and one assigned officer.
- An individual-access grant references a report, officer, unit, reason, and expiry.
- Every individual read writes an access-audit event.

## Suggested significant fields

```text
private.unit_week_metrics:
  unit_id, week_start, eligible_n, source_coverage_json,
  leave_utilization, recovery_gap, denial_rate,
  night_shifts_average, deployment_days_average,
  weekly_hours_average, index_exact, baseline_exact,
  score_version, feature_mask, computed_at

public.unit_week_releases:
  unit_id, week_start, suppression_status,
  index_approx, baseline_approx, band,
  approved_metrics_json, noise_version, released_at

public.welfare_reports:
  id, unit_id, week_start, assigned_to, trigger_rule,
  aggregate_snapshot_json, briefing_json,
  status, created_at, acknowledged_at, follow_up_on

private.access_grants:
  id, report_id, officer_id, unit_id,
  reason_code, encrypted_reason, expires_at, created_at

private.access_audit:
  id, grant_id, actor_id, report_id, action,
  row_count, occurred_at
```

## Essential constraints and indexes

- Foreign keys on every unit/person/report relationship.
- Unique published release `(unit_id, week_start)`.
- Unique internal score `(unit_id, week_start, score_version, feature_mask)`.
- At most one active welfare report per unit, enforced by a partial unique index.
- Unique processing key for `(unit_id, week_start, trigger_rule)` to make retries idempotent.
- Index releases on `(unit_id, week_start DESC)`.
- Index reports on `(assigned_to, status, created_at DESC)`.
- Check status values, positive durations, valid dates, and expiry after grant creation.

## RLS and permissions

- Enable RLS on **every client-facing table**.
- `unit_week_releases`: read only when `auth.uid()` has a protected `unit_assignments` row and a permitted role.
- `welfare_reports`: read/update only when `assigned_to = auth.uid()` and the user has the welfare role.
- `user_roles` and `unit_assignments`: no client-side writes; tightly controlled self-read if required by a policy.
- No browser role receives direct `SELECT` on private source/personnel tables.
- A materialized view may be used **inside the private schema**, but its results must pass through the controlled release process before client access.

## Break-glass implementation rule

Do not implement a normal table `SELECT` that becomes available when a grant exists: ordinary table reads cannot by themselves guarantee an audit entry for **every** read. Use a narrow database read function that checks the grant, inserts an audit row, and returns a limited result in the same transaction. Restrict function execution to a trusted server-side route and recheck actor assignment in the database.

Service-role credentials are never used in ordinary commander pages. If a narrow server route needs elevated credentials, verify the authenticated user first, pass only scoped parameters, and test unauthorized calls thoroughly.