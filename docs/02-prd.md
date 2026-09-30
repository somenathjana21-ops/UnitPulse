# 02 — Product Requirements Document

## Product

**Unit Pulse 2.0** — aggregate-first unit welfare planning and confidential escalation.

## Users and jobs

| User | Job to be done |
|---|---|
| Commander | Identify actionable leave/roster pressures within assigned units without accessing personal welfare records |
| Welfare officer | Review assigned elevated-unit reports, document supportive follow-up, and justify any exceptional individual access |
| HR uploader | Provide valid source records and identify data-quality problems without browsing welfare cases |

## MVP goals

1. Explain unit-level workload and recovery concerns in plain language.
2. Surface a meaningful departure from a unit's usual pattern.
3. Recommend small, feasible steps for a human to review.
4. Prevent routine identification of individuals by commanders.
5. Demonstrate auditable welfare-only access.

## P0 features

- Authentication and scoped role assignment.
- Synthetic-data seed and strict CSV import.
- Weekly, transparent Unit Load & Recovery Index.
- Comparable historical baseline and deduplicated report trigger.
- Published unit-summary table with group-size and small-cell suppression.
- Stored, stable noisy approximations for selected bounded counts.
- Commander dashboard: unit cards, baseline trend, leave and night-duty indicators.
- Assigned welfare inbox and case-status workflow.
- Switchable OpenAI-compatible AI adapter with validated, deterministic fallback.
- Print-friendly aggregate briefing.
- Time-limited, reasoned, audited welfare individual-access flow.

## P1 features

- Optional, consented mobile-friendly wellness check-in.
- Approved HRMS integration.
- Validated server-sent briefing delivery.
- Approved notification channel and senior-welfare escalation.
- Additional languages, accessibility testing with actual users, and offline mobile strategy.

## Explicit non-goals

- Personal stress diagnosis or a clinical probability.
- Commander access to individual risk rankings.
- Unapproved emailing of case details.
- Wearable or biometric collection.
- Using sensitive live unit locations on maps.
- Training a model on invented clinical outcome labels.

## Product rules

- The AI **never calculates or overrides** the numeric score or alert.
- Reports are created by deterministic rules, not by AI prose.
- Recommendations are framed as options: “review,” “consider,” and “offer.”
- Officer actions never automatically change HR records or a duty roster.
- Missing data means “insufficient data,” not “healthy” or “at risk.”

## Success measures for a future pilot

These are evaluation measures, not achieved results:

- Median time from report creation to assigned-officer acknowledgement.
- Percentage of elevated-unit reports receiving a documented human review.
- Officer-rated usefulness of proposed actions.
- False-alert patterns and data-quality-related missed detections.
- Zero unauthorized data accesses in role-boundary testing.

## Release gate

Do not call the MVP complete if commanders can retrieve raw individual rows, if small-group metrics leak through an API, if reports duplicate on cron retries, or if the AI can introduce unsupported facts.