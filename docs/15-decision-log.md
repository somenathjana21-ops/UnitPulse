# 15 — Decision Log

Record changes here when implementation differs from the approved design.

| ID | Decision | Why | Status / revisit |
|---|---|---|---|
| D-01 | Name the measure “Unit Load & Recovery Index,” not “stress score” | HR records reflect conditions, not a diagnosis | Accepted for MVP |
| D-02 | Default commander access is aggregate only | Prevent stigmatization and unnecessary disclosure | Accepted |
| D-03 | Use private raw tables and RLS-protected release tables | PostgreSQL materialized views are not an RLS boundary | Accepted |
| D-04 | Compute index/triggers with deterministic code | Auditability and reliable reproduction | Accepted; validate thresholds later |
| D-05 | Use an LLM only for constrained explanations | Provider output is not reliable enough for core decisions | Accepted |
| D-06 | Publish completed weekly periods | Avoid rapid changes and reduce inference risk | Accepted; review with sponsor |
| D-07 | Suppress groups under five and small cells | MVP privacy safeguard, not formal anonymity | Accepted; assess higher threshold later |
| D-08 | Sample bounded count noise once per release | Repeated page views must not reveal different values | Accepted; review privacy budget later |
| D-09 | Audit individual reads through a transactional function | Grant-based RLS alone does not log every SELECT | Accepted |
| D-10 | Public demo uses synthetic data only | Real force data requires separate approvals and infrastructure | Accepted |
| D-11 | Print-to-PDF is the MVP export | Avoid claiming an unimplemented PDF generation service | Accepted; revisit if needed |
| D-12 | No clinical ML training in MVP | No validated, ethically collected training labels | Accepted; future research only |
| D-13 | Use npm workspaces for frontend, backend, and ml isolation | Strict trust boundary separation between server-only domain, pure ML, and UI | Accepted |
| D-14 | Forbid NEXT_PUBLIC_ on service, AI, cron, and encryption secrets | Prevent any accidental credential leakage into client bundles with static and runtime guards | Accepted |
| D-15 | Enforce private schema for raw operational data and public schema for RLS-protected releases | Eliminate direct PostgREST exposure of raw personnel, leave, duty, and deployment data | Accepted |
| D-16 | Forbid RLS on materialized views | PostgreSQL engine does not support RLS on materialized views; aggregations remain in private schema | Accepted |
| D-17 | Restrict role provisioning and break-glass reads to SECURITY DEFINER service_role functions | Prevent client-side role elevation, unit self-assignment, or unlogged individual table reads | Accepted |
| D-18 | `backend/src/release.js` derives the public release band (`normal`/`elevated`/`high`) independently via `deriveReleaseBand()`, never from `ml/src/scoring.js`'s `band` field | `scoring.js`'s internal `band` uses a different vocabulary (`Normal`/`Review`/`Elevated`) for debugging and is asserted by existing Phase-1 ml tests; the public DB check constraint only accepts `normal/elevated/high/insufficient_data`. `scripts/seed-demo.js` already worked around this the same way. Changing `scoring.js` would break passing tests and isn't required. | Accepted |
| D-19 | Domain coverage in `backend/src/metrics.js` is the minimum of per-domain verified-record ratios (hr/leave/duty/deployment), and a person missing a domain's verified record is excluded from that domain's average rather than counted as zero | Matches docs/06's "80% verified coverage in each core source domain" and "missing data cannot be interpreted as zero activity"; deployment coverage counts a person as covered once their enrollment (`history_start_on`) is verified, since an absent deployment row for an enrolled person is itself the verified "not deployed" signal, not missing data | Accepted; revisit if a real deployment feed can express explicit "not deployed" rows |

## Change procedure

For any changed threshold, source field, role, privacy threshold, AI prompt contract, or hosting environment:

1. Update the relevant decision entry.
2. Update dependent specifications.
3. Add or modify tests.
4. Rerun the security/privacy release gates.