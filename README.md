# Unit Pulse 2.0

**Aggregate-first welfare intelligence for uniformed services — synthetic-data prototype.**

Unit Pulse shows possible **unit-level workload and recovery concerns** from leave and duty patterns. It provides simple, evidence-linked suggestions and routes elevated unit conditions to an assigned welfare officer. It does not diagnose personnel or support disciplinary decisions.

## Status

SIH Problem Statement 26186 prototype. **No real personnel, operational, or deployment data is permitted in this public-demo environment.**

## Roles

- Commander: approved unit summaries only.
- Welfare officer: assigned reports and exceptional audited individual access.
- HR uploader: restricted synthetic-record import.

## Repository guide

- `Project_Brief.md`: start here.
- `docs/`: product, architecture, security, and test specifications.
- `Guidebook.md`: phase-by-phase coding-agent prompts and verification.
- `frontend/`: Next.js.
- `backend/`: server-only workflows.
- `ml/`: deterministic index/baseline/trigger logic.
- `supabase/migrations/`: database schema and access policy.

## Planned local commands

The implementation must provide these root-workspace scripts:

```bash
npm install
npx supabase start
npx supabase db reset
cp .env.example frontend/.env.local
# Fill local Supabase values reported by: npx supabase status
npm run seed:demo
npm run dev
npm run test
npm run build
```

Do not claim these commands work until the corresponding code and scripts have been implemented.

## AI setup

The system works in `NO_LLM_MODE=true` using deterministic explanations. To enable an approved OpenAI-compatible provider, configure server-only `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`, and capability flag `AI_JSON_MODE`. Never put provider keys in browser code.

## Privacy limitations

A five-person group threshold, coarsened metrics, and noise on selected counts reduce—but do not eliminate—re-identification risk. This prototype is not certified as clinically predictive, formally anonymous, or approved for real force records.

## License

Repository-authored code may be distributed under `LICENSE`. Third-party logos, SIH templates, external datasets, and organizational data are not covered by that code license.