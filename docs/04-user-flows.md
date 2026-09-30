# 04 — User Flows and UX Specification

## UX principle

The product should answer three questions in order:

1. **What changed?**
2. **What records support that observation?**
3. **What simple action can a person review?**

Avoid leading with a medical-sounding “stress score.” Label the index **Unit Load & Recovery Index** and explain that it measures recorded work-and-rest conditions.

## Screen map

```text
/                         Public explanation; synthetic-demo disclaimer
/login                    Supabase authentication

/commander                Assigned unit cards and trends
/commander/units/[id]     Approved aggregate detail and briefing

/welfare                  Assigned report inbox
/welfare/reports/[id]     Report, follow-up, access request
/welfare/audit            Officer's own audit trail

/admin/import             Strict CSV import and data-quality feedback
```

The `/admin/import` route is for the `hr_uploader` role; the path name does not imply superuser permissions.

## Flow A — Commander review

1. Sign in and see **only assigned units**.
2. View each unit's band: `Normal`, `Review`, or `Elevated`.
3. Select a unit to see a weekly trend against its baseline.
4. Read two or three metric-grounded possible contributors.
5. See suggested leave/roster actions with feasibility caveats.
6. Print the aggregate briefing if needed.

**Never show:** names, personnel IDs, individual-level charts, hidden group sizes, medical claims, or private case notes.

## Flow B — Welfare review

1. Assigned officer sees a new report in their inbox.
2. Opens aggregate snapshot and reason for triggering.
3. Acknowledges, records a supportive action, and schedules follow-up.
4. If individual records are genuinely necessary, selects “Request limited individual view.”
5. Enters a reason linked to the current report.
6. Sees access scope and a 30-minute expiry before confirming.
7. Each paginated individual read is logged.
8. Officer closes the report only with a documented follow-up outcome.

## Flow C — Importer

1. Upload approved **synthetic** CSV.
2. Preview schema-validation results; not personnel welfare content.
3. Confirm import; receive row counts and rejected-row reasons.
4. Recompute only through the controlled weekly process.

## Empty and error states

- **Small group:** “Insufficient group size to show this view.” Do not reveal the exact small count.
- **Revealing breakout:** “This detail is withheld to protect privacy.”
- **Incomplete records:** “Not enough verified data for an index.”
- **No baseline:** “Collecting comparable weeks.”
- **AI unavailable:** “Standard, data-based explanation shown.”
- **Expired welfare access:** “Access expired; request a new reasoned grant.”

## Guidance and visual design

- Use a unit **card grid**, not exact operational geolocation.
- Explain the index in a short tooltip and a dedicated “How this works” drawer.
- Use icon + text as well as color.
- Place “possible contributors” directly beside “actions to consider.”
- Keep individual-access controls visually separate and clearly exceptional.
- No auto-refresh that reveals an individual's presence through rapidly changing statistics.