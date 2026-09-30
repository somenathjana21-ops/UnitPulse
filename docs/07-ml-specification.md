# 07 — AI/ML and Decision-Logic Specification

## What “AI” does in the MVP

1. A **deterministic analytic engine** computes unit indicators, an index, and triggers.
2. A **switchable language model** explains permitted aggregate observations and proposes bounded, supportive actions.

There is **no trained clinical prediction model** in the MVP and no claim to infer an individual's diagnosis.

## Unit Load & Recovery Index

Calculate from verified aggregate inputs. Maximum score: 100.

| Component | Rule | Points |
|---|---|---:|
| Leave | Mean days since qualifying leave >60 | 15 |
| Leave | Recovery gap >35% | 10 |
| Leave | Denial rate >25%, when enough decided requests exist | 5 |
| Night duty | Mean 28-day night shifts >5, >8, or >12 | 5, 15, or 25 respectively; select one |
| Deployment | Mean continuous days >60 or >90 | 12 or 20; select one |
| Workload | Mean weekly hours >52 or >60 | 8 or 25; select one |

The four component maxima are **30 + 25 + 20 + 25 = 100**. Thresholds and weights are illustrative policy settings, not clinical findings.

If the five-point denial rule lacks sufficient request volume, omit it and calculate:

`index = round(100 × awarded_points / 95)`

Mark the feature-availability mask; compare only with prior weeks having the same mask. If required source coverage is insufficient, do **not** calculate an index.

## Baseline and triggers

- Baseline: median of up to **eight previous completed weekly indices** from the same unit, score version, and feature mask.
- Require at least **four comparable previous weeks** to apply the spike rule.
- **Spike trigger:** current index ≥40 **and** current index ≥ baseline +15.
- **Sustained-high trigger:** index ≥75 for **two consecutive completed weeks**.
- One active report per unit; weekly-job retries must not duplicate it.

The sustained-high rule protects against a chronically elevated unit baseline. Neither rule proves that any person is stressed.

## Explainability contract

The backend supplies:

- Published, privacy-checked metrics only.
- An allow-list of evidence keys.
- The exact triggered rule.
- Permitted action categories: `review_leave_queue`, `rebalance_roster`, `plan_recovery`, `offer_welfare_review`, `verify_data`.

The model returns structured reasons and suggested actions. Validate with a schema and check every evidence key against the input. Build the final displayed numerical statements **server-side from approved values**; do not trust numbers written by the model.

Example acceptable wording:

> “The unit has a higher night-duty indicator than its recent comparison period. Consider reviewing roster distribution, subject to operational cover.”

Unacceptable:

> “Personnel are depressed,” or “Night shifts caused burnout.”

If a model is unavailable, times out, returns invalid JSON, cites an absent metric, or suggests a punitive action, use deterministic templates.

## Provider switching

Server-side environment variables specify `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, and `AI_JSON_MODE`. Some OpenAI-compatible providers do not implement the same JSON-mode or streaming options; the adapter must support capability flags, timeouts, one bounded retry, and fallback.

Never call a model directly from the browser. Never send raw individual records, typed welfare reasons, exact locations, or personal notes to a provider.

## Validation plan

Evaluate fixture-level scoring correctness, trigger precision against synthetic labeled scenarios, explanation grounding, rejection of adversarial model responses, and welfare-officer usefulness. Do not report clinical sensitivity/specificity without real, ethically collected outcome data and independent validation.