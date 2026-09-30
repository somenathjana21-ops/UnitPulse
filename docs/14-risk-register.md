# 14 — Risk Register

| ID | Risk | Severity | Mitigation | MVP owner/check |
|---|---|---|---|---|
| R-01 | Unit data wrongly interpreted as personal stress diagnosis | High | Rename to load/recovery index; explicit non-clinical wording | Product review |
| R-02 | Small groups or repeated releases enable re-identification | High | Suppression, restricted filters, stable approximations, specialist review | Privacy tests |
| R-03 | Service-role key exposes database | Critical | Server-only secrets, narrow usage, rotation, secret scan | Security review |
| R-04 | RLS misses an API path | Critical | Private schema, deny-by-default, cross-role API tests | Integration tests |
| R-05 | Individual read occurs without audit | Critical | Single transactional read function; no raw SELECT | DB tests |
| R-06 | AI invents facts or recommends punishment | High | Validated evidence keys/actions and deterministic fallback | AI adversarial tests |
| R-07 | Incomplete HR data creates false reassurance | High | Coverage threshold, missing-data state, no default zero | Fixture tests |
| R-08 | Thresholds generate excessive/poor alerts | Medium/High | Document assumptions, officer feedback, future local validation | Pilot evaluation |
| R-09 | Unapproved real data enters demo | Critical | Synthetic-data policy, import warning, controlled access, team review | Deployment gate |
| R-10 | Weekly cron generates duplicate cases | Medium | Unique keys, locking, active-report constraint | Idempotency test |
| R-11 | Officer actions unavailable because AI API fails | Medium | Deterministic briefing fallback | Outage test |
| R-12 | Operational constraints make recommendations impractical | Medium | Phrase as “consider”; human roster/leave feasibility review | Officer feedback |

## Escalation rule

A critical privacy or authorization issue blocks deployment regardless of visual completeness. Do not treat a mock dashboard as evidence that the full welfare system is operational.