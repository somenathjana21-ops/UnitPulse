# 08 — API Specification

## Conventions

- Prefix: `/api`.
- JSON responses unless uploading a CSV or using an event stream.
- Authenticated session required except public information routes.
- User identity and permitted unit scope come from the session and database, **not** from a request-supplied role.
- Protected responses: `Cache-Control: no-store`.
- Error shape: `{ "error": { "code": "...", "message": "..." } }`.
- Do not return internal SQL, hidden metrics, or raw AI errors to clients.

## Commander

| Method/path | Access | Output |
|---|---|---|
| `GET /api/commander/units` | Commander; assigned units | Approved weekly cards, suppression states |
| `GET /api/commander/units/:unitId?week=YYYY-MM-DD` | Commander assigned to unit | Approved release and comparison trend |
| `GET /api/briefings/:unitId?week=YYYY-MM-DD` | Authorized role for unit | Stored, validated aggregate briefing |
| `GET /api/briefings/:unitId/events?week=...` | Authorized role for unit | Optional SSE of already-validated briefing sections |
| `GET /api/briefings/:unitId/print?week=...` | Authorized role for unit | Print-friendly aggregate HTML |

The print page supports browser **Print → Save as PDF**. Do not advertise automatic server-generated PDF unless implemented.

## Welfare

| Method/path | Access | Output |
|---|---|---|
| `GET /api/welfare/reports` | Assigned welfare officer | Paginated assigned report list |
| `GET /api/welfare/reports/:id` | Officer assigned to report | Aggregate report and workflow state |
| `PATCH /api/welfare/reports/:id` | Assigned officer | Validated status/follow-up transition |
| `POST /api/welfare/reports/:id/access-grants` | Assigned officer | Reasoned, 30-minute grant metadata |
| `GET /api/welfare/reports/:id/individuals?grantId=...&cursor=...` | Officer with active scoped grant | Up to 20 pseudonymous records; audited in DB |
| `GET /api/welfare/audit` | Officer | Own access history |

### Grant request

```json
{
  "reasonCode": "welfare_review",
  "reason": "Review leave and roster records needed for report follow-up."
}
```

The server rejects an empty/short reason, verifies assignment, encrypts the reason for storage, and creates the grant. The client cannot choose its own expiry or a different unit.

## Import and worker

| Method/path | Access | Output |
|---|---|---|
| `POST /api/admin/import` | HR uploader | Schema errors or imported row counts |
| `GET /api/internal/weekly-run` | Cron secret, server-only | Job ID, counts, failure state |

Vercel Cron invokes a protected `GET` route; verify `Authorization: Bearer <CRON_SECRET>` server-side. Do not allow a browser role to trigger arbitrary recomputation.

## Example approved unit response

```json
{
  "unitCode": "UNIT-B",
  "weekStart": "2026-08-03",
  "status": "elevated",
  "indexApprox": 75,
  "baselineApprox": 50,
  "metrics": {
    "recoveryGapPercentApprox": 40,
    "nightShiftsAverageApprox": 13,
    "leaveUtilizationBucket": "20–29%"
  },
  "suppressed": false,
  "approximate": true
}
```

All example values are illustrative synthetic output. Exact trigger calculations remain private.

## Critical negative responses

- `401`: unauthenticated.
- `403`: wrong role, unit, assigned officer, or grant.
- `404`: missing resource or deliberately concealed unauthorized resource.
- `409`: duplicate active report or invalid state transition.
- `422`: invalid import, reason, or source data.
- `429`: rate limit for expensive generation/import requests.
- `503`: unavailable generation service **only if** deterministic fallback also fails.