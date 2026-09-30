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

## Change procedure

For any changed threshold, source field, role, privacy threshold, AI prompt contract, or hosting environment:

1. Update the relevant decision entry.
2. Update dependent specifications.
3. Add or modify tests.
4. Rerun the security/privacy release gates.