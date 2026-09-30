# 11 — Testing Plan

## Test layers

1. **Unit tests:** metric definitions, missing data, scoring, baselines, triggers, suppression, noise generation, AI validation.
2. **Database integration tests:** constraints, RLS, role scope, private-schema permissions, idempotent weekly processing.
3. **API tests:** unauthorized access, validation, error codes, no-store headers, report transitions, grant expiry.
4. **Browser tests:** role-specific flows, suppressed UI, accessible charts, print view.
5. **Adversarial tests:** prompt injection, malformed provider responses, CSV injection, direct API guessing, repeated-request inference.

## Required fixtures

- Six fictional units with 60 people each.
- One unit with a large baseline jump.
- One stable unit.
- A four-person unit: fully suppressed.
- A five-person group with a revealing one-person breakout: breakout suppressed.
- A unit with incomplete duty data: no index.
- A unit with too few decided leave requests: omitted denial feature and matching-mask baseline.
- Two consecutive sustained-high weeks.
- AI returning invented numbers and a punitive recommendation.

## Critical tests

| ID | Given | Expected |
|---|---|---|
| T-01 | Commander requests another unit | 403/404; no leaked row |
| T-02 | Commander requests `/individuals` | 403 |
| T-03 | Four-person group | Neither API nor UI returns its figures or exact count |
| T-04 | Repeated weekly-release GET | Identical noisy numbers each time |
| T-05 | Cron called twice for same week | One release and at most one active report |
| T-06 | Officer lacks assignment | Report and grant denied |
| T-07 | Officer omits reason | Grant denied |
| T-08 | Grant expired or for different unit | Read denied |
| T-09 | Authorized paginated individual read | Matching audit event written before data returned |
| T-10 | Model invents unsupported percentage | Output rejected; fallback shown |
| T-11 | AI key missing | Entire main workflow still works |
| T-12 | Print view | Aggregate only; no pseudonymous individual rows |
| T-13 | Missing history | “Insufficient data,” not zero risk |
| T-14 | Cross-unit / small-cell drill-down attempt | No suppressed details exposed |

## Performance checks

Measure dashboard response time, weekly-job duration, AI timeout/fallback, and imported-row validation using the demo dataset. Record actual measurements and environment in `tests/results/`; never state an unmeasured “under one second” guarantee.

## Release-blocking failures

Any role boundary break, raw-data exposure, small-group leak, unaudited individual read, repeated cron report duplication, unsupported AI claim in displayed text, or checked-in secret blocks deployment.