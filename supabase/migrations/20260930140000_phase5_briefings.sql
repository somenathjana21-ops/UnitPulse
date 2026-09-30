-- ==============================================================================
-- Unit Pulse 2.0 — Phase 5: Storage of Validated Aggregate Briefings
-- Specifications: docs/07-ml-specification.md, docs/08-api-specification.md,
-- docs/09-database-design.md, docs/10-security-privacy.md
-- ==============================================================================

-- Add briefing_json column to public.unit_week_releases
-- Stores the validated, aggregate-only weekly briefing for each released unit-week.
-- Access is strictly protected by existing unit_week_releases RLS policies:
-- commanders and welfare officers assigned to the unit can view aggregate briefings;
-- anonymous and unauthorized actors receive no rows.

alter table public.unit_week_releases
  add column if not exists briefing_json jsonb not null default '{}'::jsonb;

comment on column public.unit_week_releases.briefing_json is
  'Validated server-side aggregate briefing containing summary, contributing factors with verified metrics, supportive options, and non-diagnostic disclaimer. Strictly aggregate-only; zero personnel identifiers.';
