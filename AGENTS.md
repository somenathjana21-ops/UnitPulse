# AGENTS.md — Unit Pulse 2.0

You are working on a synthetic-data prototype for SIH Problem Statement 26186.
This file is the single source of truth for how any coding agent must behave here.

## Start every session by reading, in order
1. `docs/STATUS.md` — current phase, what is done, what is broken.
2. The newest file in `docs/handoff/`.
3. `Project_Brief.md`.
4. The phase you are assigned in `Guidebook.md` and the docs it lists.

Do not start coding until you have read these.

## Non-negotiable rules
- Synthetic data only. Never add real names, forces, locations, or rosters.
- Commander role sees aggregates only. No personnel IDs in commander UI or API.
- Code computes the index/baseline/trigger. The LLM only explains approved aggregates.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `CRON_SECRET`, or the
  encryption key to the browser. Never prefix them with `NEXT_PUBLIC_`.
- Never commit `.env.local` or any secret.
- Call the measure "Unit Load & Recovery Index". Never "stress score" or "diagnosis".
- Do not remove or weaken a privacy check to make a demo work.
- Do not claim a test passed if you did not run it. Say "NOT RUN" instead.

## Stack
Next.js App Router (JavaScript), Supabase (Postgres + Auth + RLS), Vercel,
server-side OpenAI-compatible adapter. npm workspaces: `frontend/`, `backend/`, `ml/`.

## Commands (root)
`npm run dev` · `npm run lint` · `npm run test` · `npm run test:e2e` ·
`npm run build` · `npm run seed:demo` · `npx supabase db reset`

If a command in this list does not exist yet, say so; do not invent it.

## Conventions
- Migrations: `supabase/migrations/<timestamp>_<name>.sql`
- Server-only logic in `backend/`; pure deterministic functions in `ml/`.
- Protected routes return `Cache-Control: no-store`.
- Tests live in `tests/`; save real command output to `tests/results/`.

## End every session by
1. Updating `docs/STATUS.md` (phase, done, verified, broken, next).
2. Appending any design change to `docs/15-decision-log.md`.
3. Writing/updating `docs/handoff/phase-N.md` if a phase ended.
4. Listing files changed and commands actually run, with exit codes.
5. Committing with message `phase-N: <what changed>`.

## Specs
See `docs/01` … `docs/15`. When a spec and the code disagree, stop and ask;
do not silently change either.