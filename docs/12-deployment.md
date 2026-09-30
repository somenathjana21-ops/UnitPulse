# 12 — Deployment and DevOps

## Environments

| Environment | Data | Purpose |
|---|---|---|
| Local | Synthetic | Coding and tests |
| Preview | Synthetic | Team review |
| Public demo | Synthetic only | SIH judging |
| Future approved deployment | To be determined by sponsor | Requires separate security/legal/hosting approval |

## Local setup contract

1. Install supported Node.js LTS and npm.
2. Install dependencies from the repository root.
3. Start the local Supabase stack.
4. Apply migrations.
5. Copy `.env.example` to `frontend/.env.local` and fill local Supabase credentials.
6. Seed fictional units.
7. Run tests, then start Next.js.

Root `package.json` scripts should expose:

```text
npm run dev
npm run lint
npm run test
npm run test:e2e
npm run build
npm run seed:demo
```

Implement these scripts before publishing the README as working instructions.

## Vercel

- Set the Next.js root directory to `frontend` while building within the npm workspace configuration.
- Put `AI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and encryption key in **server-side** project environment variables.
- Only `NEXT_PUBLIC_SUPABASE_URL` and the Supabase publishable/anon key may use `NEXT_PUBLIC_`.
- Confirm the chosen function region is available and appropriate relative to the database; benchmark actual latency.
- Disable or limit production cron if the project is a public synthetic demonstration without continuously generated source records.

## Scheduled job

A Vercel Cron schedule calls `/api/internal/weekly-run` with a server-checked bearer secret. The job processes only completed weeks, applies database locking/unique constraints, and records job outcomes. A failed job must not publish partial privacy releases.

## AI-provider configuration

Switch `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`; configure `AI_JSON_MODE` for provider capabilities. Do not put provider URLs or API keys into client-side configuration unnecessarily. `NO_LLM_MODE=true` runs the deterministic fallback.

## CI gates

- Dependency installation using the lockfile.
- Lint/build.
- Unit/integration tests.
- Database migration and RLS smoke tests.
- Secret-scanning check.
- A manual synthetic-demo walkthrough before submission.

## Operational caution

Do not claim a public Vercel/Supabase deployment is authorized for real CRPF, CAPF, or Armed Forces records. If a sponsor requests a pilot, redesign hosting, key management, data retention, and security accreditation with that sponsor first.