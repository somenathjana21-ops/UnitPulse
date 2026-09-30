# 10 — Security and Privacy Specification

## Principle

Use the least identifying data and least privilege necessary for **welfare support, not surveillance or discipline**.

## Key safeguards

1. **Synthetic-only public prototype.** No real personnel, sensitive unit location, roster, or deployment data on the demo deployment.
2. **Authentication and scope.** Supabase Auth; roles and unit assignments managed in protected tables, never user-editable metadata.
3. **Database separation.** Raw person-level records in an unexposed private schema; approved aggregate releases in RLS-protected tables.
4. **Suppression.** Do not publish a group with fewer than five eligible people. Suppress sensitive cells or complements under five, and avoid arbitrary subgroup filters.
5. **Stable approximation.** Publish selected bounded noisy counts once per completed week; do not resample on each page request.
6. **Encryption.** HTTPS/TLS, platform encryption at rest, and AES-256-GCM for stored free-text access reasons. Keep keys in server-only secret storage; include key version and unique nonce. Never log plaintext reasons.
7. **Audited exception.** Assigned officer, linked report, typed reason, 30-minute server-enforced expiry, and a database audit entry per individual read.
8. **No sensitive AI input.** Only approved released aggregates and evidence keys leave the backend.
9. **No protected caching.** `no-store` for role-specific APIs/pages; do not PWA-cache reports or individual records.
10. **Human decision.** Neither a score nor an AI recommendation changes duty, leave, discipline, or medical status automatically.

## Threats and responses

| Threat | Response |
|---|---|
| Commander guesses another unit ID | API authorization + unit-scoped RLS |
| Malicious user queries raw PostgREST tables | Private schema not exposed; no direct grants |
| Identifying a person from a small subgroup | Suppression, restricted filters, coarse buckets, review of repeated releases |
| Comparing adjacent weeks to infer one person's change | Fixed weekly cadence, stable releases, coarsening; residual risk explicitly acknowledged |
| AI invents diagnoses or figures | Evidence-key allow-list, structured validation, server-built numeric phrasing, fallback |
| Officer misuses individual access | Assigned-case restriction, compulsory reason, expiry, per-read audit and periodic review |
| Service credential leaks | Server-only secret, rotation, restricted internal use, incident procedure |
| HTML/CSV injection | Strict import validation, output escaping, safe CSV parsing |
| Cached protected response | `no-store` and browser/network tests |

## Important limitation

A minimum group size of five is **not** a formal proof of k-anonymity. Adding Laplace noise to some counts does **not** make the entire system formally differentially private. Overlapping time windows, context, released index bands, and operational knowledge can still create inference risks. Obtain specialist review before real deployment.

## Data lifecycle

- Define actual retention/deletion schedules with the sponsoring organization before live use.
- Demo seeds are disposable and reproducible.
- Restrict access to audit logs; do not let audited users erase them.
- Preserve only aggregate briefing data needed for reports; avoid unnecessary copies of raw records.
- Document key rotation and encrypted-field migration before enabling real free-text records.

## Legal and operational deployment

Assess applicable Indian data-protection requirements, organizational policy, government security requirements, consent and lawful-purpose requirements, vendor contracts, data residency, and incident reporting with qualified stakeholders. A Vercel/Supabase synthetic demo does **not** establish approval to host real uniformed-force data.