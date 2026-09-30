# 06 — Data Specification and Dictionary

## Data classification

- **Public:** landing-page explanation only.
- **Restricted aggregate:** weekly unit releases and aggregate briefing.
- **Confidential operational:** individual leave/duty/deployment records.
- **Confidential welfare:** reports, access reasons, and audit history.

The demo contains **synthetic records only**. Pseudonymous identifiers are still treated as personal data when they can be linked back to people.

## Source entities

| Entity | Important fields | Meaning |
|---|---|---|
| `units` | `id`, `display_code`, `active` | Unit label; no exact live location |
| `personnel` | `id`, `unit_id`, `active`, `history_start_on` | Pseudonymous person and verified history start |
| `leave_eligibility` | `personnel_id`, `snapshot_week`, `eligible_days_90d`, `verified` | HR-confirmed eligibility for the preceding 90 days |
| `leave_records` | `id`, `personnel_id`, `status`, `start_on`, `end_on`, `qualifying`, `decided_on` | One leave request/record; status: `pending`, `approved`, `denied`, or `taken` |
| `duty_records` | `personnel_id`, `duty_date`, `shift_type`, `hours` | Recorded daily hours and day/night designation |
| `deployments` | `personnel_id`, `start_on`, `end_on`, `verified` | Continuous assignment period; no precise location needed |

## Definitions

- **Leave-days utilization, 90 days:** qualifying days actually taken ÷ verified eligible days for the same 90-day window. A zero or unknown denominator is “unavailable.”
- **Leave coverage, 90 days:** eligible personnel who took at least one qualifying leave ÷ eligible personnel with verified records.
- **Days since last qualifying leave:** measured from the end date of qualifying leave. If history is too short to establish recency, mark unknown; never assume “no leave.”
- **Recovery gap:** percentage of personnel with verified history who have had no qualifying leave for **more than 60 days**.
- **Leave denial rate:** denied requests ÷ decided requests (`approved` + `taken` + `denied`); pending requests are excluded.
- **Leave backlog:** pending requests older than seven days. Denied requests are *not* pending backlog.
- **Night-duty load:** mean night shifts per active personnel during the preceding 28 days.
- **Deployment continuity:** mean current continuous deployment days across active personnel; verified non-deployed personnel contribute zero.
- **Weekly workload:** mean recorded duty hours per active personnel during the preceding seven days.

`qualifying` means approved restorative leave for this prototype, not medical or otherwise sensitive leave categories. Actual category selection requires organizational policy review.

## Quality rules

- At least **80% verified coverage** in each core source domain is required for a unit index.
- Missing duty or deployment data cannot be interpreted as zero activity.
- Duplicate requests and overlapping leave periods must be detected.
- Duty hours must be within plausible daily bounds and cannot be double-counted.
- If fewer than five decided leave requests exist, omit the five-point denial feature and normalize the remaining available maximum. Compare baselines only with matching feature availability.
- All source timestamps use an agreed timezone; completed reporting weeks are stored as dates.

## Published release

`unit_week_releases` contains a unit code, completed week, coarsened index/baseline, status, coverage flag, approved approximate aggregate metrics, and suppression indicators. It never contains personnel IDs.

Selected **bounded person-count** measures receive calibrated Laplace noise sampled using cryptographically secure randomness **once** per unit/week and stored. Counts are clamped to a valid range and marked approximate. For the MVP, use `epsilon = 0.2` per released bounded count; bound each person's contribution to 0 or 1 for that count.

Other exposed measures are coarsened/bucketed and suppressed when revealing. Do not claim the *entire application* is differentially private: repeated overlapping weeks, index bands, and additional released measures need a broader privacy analysis.

## Demo dataset

Generate six fictional units with 60 synthetic personnel each and approximately 180 days of record history. Produce at least 12 completed weekly snapshots after adequate warm-up. Create one unit with elevated leave/night-duty conditions and another with stable recovery patterns.

Do not seed real names, actual unit names, actual locations, genuine force rosters, or real biometric data.