# 03 — Software Requirements Specification

## Actors

- `commander`: approved summaries for assigned units only.
- `welfare_officer`: approved summaries and assigned welfare reports; individual data only through an active audited grant.
- `hr_uploader`: restricted import functions and validation results, not welfare cases.
- `system_worker`: weekly aggregation and report creation; server-side only.

Role assignments are stored in protected database tables. Users cannot set their own role through editable browser metadata.

## Functional requirements

| ID | Requirement | Acceptance check |
|---|---|---|
| FR-01 | Require authentication on all non-public pages and APIs | Anonymous requests are rejected |
| FR-02 | Restrict unit visibility to a user's assigned units | Cross-unit URL/API attempts return 403 or 404 |
| FR-03 | Validate imported CSV schema, limits, dates, and relationships | Bad rows cause an explained failure; no partial silent import |
| FR-04 | Compute weekly metrics from verified source records | Same fixture yields the same internal metrics |
| FR-05 | Suppress release for eligible group size <5 and revealing breakouts | Neither UI nor API contains the hidden number |
| FR-06 | Publish selected noised counts once per immutable weekly release | Repeated requests return identical released values |
| FR-07 | Compute deterministic index, baseline, and alert rules | Boundary tests pass |
| FR-08 | Create no more than one active report per unit | Weekly-run retries do not duplicate reports |
| FR-09 | Show commanders aggregate evidence and workload actions only | Commander APIs never contain personnel IDs |
| FR-10 | Restrict welfare cases to assigned officers | Other officers cannot read/update a case |
| FR-11 | Require a reason, report scope, and expiry for individual access | Empty/expired/unassigned grants fail |
| FR-12 | Log every individual read before returning data | Each successful read has a matching audit event |
| FR-13 | Validate AI output against evidence and approved action types | Invented facts are rejected; fallback shown |
| FR-14 | Support print/save-to-PDF of aggregate briefing | Printed page contains no individual records |
| FR-15 | Expose incomplete-data state | Missing sources never produce a reassuring zero score |

## Non-functional requirements

- **Privacy:** Protected pages and API responses use `Cache-Control: no-store`; service-role keys never enter client code.
- **Security:** TLS, Supabase Auth, protected schemas, RLS on released tables, server-verified permissions, and audit logging.
- **Performance target:** Warm aggregate pages should load within roughly two seconds under demo conditions; measure rather than promise. AI is asynchronous with a loading state and a deterministic fallback.
- **Availability:** Dashboard and stored fallback briefing remain useful when the external AI provider is unavailable.
- **Accessibility:** Keyboard-operable navigation; readable chart summaries; do not rely on color alone.
- **Usability:** Each role sees at most four primary navigation entries.
- **Maintainability:** Scoring, privacy release, AI adapter, and API authorization have separate tested modules.

## Data and alert timing

- The MVP runs on **completed weekly periods**.
- Leave utilization considers the preceding **90 days**.
- Night-duty load considers **28 days**.
- Working hours consider the preceding **7 days**.
- Historical baseline considers up to **eight earlier comparable completed weeks**, with at least four required.

## Failure behavior

- Incomplete source coverage: suppress index and create a data-quality issue.
- Missing baseline: display “building baseline”; use only the separately defined sustained-high rule.
- AI failure: use approved deterministic text.
- Failed weekly job: show last successful refresh and error to maintainers; do not serve partial releases.