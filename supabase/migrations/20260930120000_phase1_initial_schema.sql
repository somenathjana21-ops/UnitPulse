-- ==============================================================================
-- Migration: 20260930120000_phase1_initial_schema.sql
-- Unit Pulse 2.0 — Phase 1: Database Schema, Roles, and RLS Policies
-- Specifications: docs/03-srs.md, docs/06-data-specification.md,
--                 docs/09-database-design.md, docs/10-security-privacy.md
--
-- NON-NEGOTIABLE PRINCIPLES:
-- 1. Private raw tables: Raw personnel, leave, duty, and deployment records live
--    in the 'private' schema, strictly unexposed to browser/PostgREST clients.
-- 2. Client-facing public tables: RLS enabled on every public table.
-- 3. Anonymous users cannot read any private or client-facing tables.
-- 4. Commanders can ONLY query approved aggregate releases for their assigned units.
-- 5. No personal identifiers (personnel_id, names) exist in public releases.
-- 6. PostgreSQL does NOT support RLS on materialized views. Any materialized views
--    must reside strictly inside 'private' and flow through the privacy release worker.
-- 7. Role provisioning is narrow, security definer, and restricted to service_role.
-- ==============================================================================

-- 1. Schemas setup
create schema if not exists private;
create schema if not exists auth;

-- Revoke all direct permissions on private schema from browser/client roles
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;
grant usage on schema private to postgres;

-- Ensure auth.users exists (for standalone test environments where Supabase auth isn't pre-booted)
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 2. PRIVATE SOURCE TABLES (Raw Operational Data — Never exposed to browser)
-- ==============================================================================

-- 2.1 Units Table (Fictional Unit Definitions)
create table if not exists private.units (
  id text primary key, -- e.g., 'UNIT-A', 'UNIT-B'
  display_code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2.2 Personnel Table (Pseudonymous Identifiers Only — No Real Names)
create table if not exists private.personnel (
  id text primary key, -- e.g., 'PER-A-001'
  unit_id text not null references private.units(id) on delete restrict,
  active boolean not null default true,
  history_start_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_personnel_unit_active
  on private.personnel (unit_id, active);

-- 2.3 Leave Eligibility Table (HR-confirmed eligibility for 90d window)
create table if not exists private.leave_eligibility (
  id uuid primary key default gen_random_uuid(),
  personnel_id text not null references private.personnel(id) on delete cascade,
  snapshot_week date not null,
  eligible_days_90d integer not null check (eligible_days_90d >= 0),
  verified boolean not null default true,
  created_at timestamptz not null default now(),
  constraint uq_leave_eligibility_person_week unique (personnel_id, snapshot_week)
);

create index if not exists idx_leave_eligibility_week
  on private.leave_eligibility (snapshot_week, personnel_id);

-- 2.4 Leave Records Table (Requests & Taken Leave)
create table if not exists private.leave_records (
  id text primary key, -- e.g., 'LR-A-0001'
  personnel_id text not null references private.personnel(id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'denied', 'taken')),
  start_on date not null,
  end_on date not null,
  qualifying boolean not null default true,
  decided_on date,
  created_at timestamptz not null default now(),
  constraint chk_leave_dates check (end_on >= start_on),
  constraint chk_leave_decision check (
    (status = 'pending') or
    (status in ('approved', 'denied', 'taken') and decided_on is not null)
  )
);

create index if not exists idx_leave_records_person_dates
  on private.leave_records (personnel_id, start_on, end_on);

create index if not exists idx_leave_records_status_decided
  on private.leave_records (status, decided_on);

-- 2.5 Duty Records Table (Daily Shifts & Recorded Hours)
create table if not exists private.duty_records (
  id uuid primary key default gen_random_uuid(),
  personnel_id text not null references private.personnel(id) on delete cascade,
  duty_date date not null,
  shift_type text not null check (shift_type in ('day', 'night', 'rest', 'training')),
  hours numeric(4,1) not null check (hours >= 0.0 and hours <= 24.0),
  created_at timestamptz not null default now(),
  constraint uq_duty_records_person_date unique (personnel_id, duty_date)
);

create index if not exists idx_duty_records_date_shift
  on private.duty_records (duty_date, shift_type);

-- 2.6 Deployments Table (Continuous Field Assignment Periods)
create table if not exists private.deployments (
  id text primary key, -- e.g., 'DEP-A-0001'
  personnel_id text not null references private.personnel(id) on delete cascade,
  start_on date not null,
  end_on date,
  verified boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chk_deployment_dates check (end_on is null or end_on >= start_on)
);

create index if not exists idx_deployments_person_dates
  on private.deployments (personnel_id, start_on, end_on);

-- 2.7 Internal Unit Week Metrics (Pre-release exact figures)
create table if not exists private.unit_week_metrics (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references private.units(id) on delete cascade,
  week_start date not null,
  eligible_n integer not null check (eligible_n >= 0),
  source_coverage_json jsonb not null default '{}'::jsonb,
  leave_utilization numeric(5,2),
  recovery_gap numeric(5,2),
  denial_rate numeric(5,2),
  night_shifts_average numeric(5,2),
  deployment_days_average numeric(5,2),
  weekly_hours_average numeric(5,2),
  index_exact integer check (index_exact is null or (index_exact >= 0 and index_exact <= 100)),
  baseline_exact integer check (baseline_exact is null or (baseline_exact >= 0 and baseline_exact <= 100)),
  score_version text not null default 'v1',
  feature_mask text not null default 'FULL',
  computed_at timestamptz not null default now(),
  constraint uq_unit_week_metrics_version unique (unit_id, week_start, score_version, feature_mask)
);

create index if not exists idx_unit_week_metrics_unit_week
  on private.unit_week_metrics (unit_id, week_start desc);


-- ==============================================================================
-- 3. PUBLIC CLIENT-FACING TABLES (Protected by Row Level Security)
-- ==============================================================================

-- 3.1 User Roles Table (Protected role registry)
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('commander', 'welfare_officer', 'hr_uploader', 'system_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.2 Unit Assignments Table (User to Unit mapping)
create table if not exists public.unit_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id text not null references private.units(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  constraint uq_unit_assignment unique (user_id, unit_id)
);

create index if not exists idx_unit_assignments_user
  on public.unit_assignments (user_id);

create index if not exists idx_unit_assignments_unit
  on public.unit_assignments (unit_id);

-- 3.3 Published Unit Week Releases (Approved Privacy-Checked Releases)
-- Bounded noise applied once at release time; groups <5 suppressed. No personnel IDs.
create table if not exists public.unit_week_releases (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references private.units(id) on delete cascade,
  week_start date not null,
  suppression_status text not null check (
    suppression_status in ('published', 'suppressed_small_group', 'insufficient_coverage', 'building_baseline')
  ),
  index_approx integer check (index_approx is null or (index_approx >= 0 and index_approx <= 100)),
  baseline_approx integer check (baseline_approx is null or (baseline_approx >= 0 and baseline_approx <= 100)),
  band text check (band is null or band in ('normal', 'elevated', 'high', 'insufficient_data')),
  approved_metrics_json jsonb not null default '{}'::jsonb,
  noise_version text not null default 'laplace_eps_0_2_v1',
  released_at timestamptz not null default now(),
  constraint uq_unit_week_releases unique (unit_id, week_start)
);

create index if not exists idx_unit_week_releases_unit_week
  on public.unit_week_releases (unit_id, week_start desc);

-- 3.4 Welfare Reports (Confidential Actionable Reports)
create table if not exists public.welfare_reports (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references private.units(id) on delete cascade,
  week_start date not null,
  assigned_to uuid not null references auth.users(id) on delete restrict,
  trigger_rule text not null check (trigger_rule in ('spike', 'sustained_high', 'manual_escalation')),
  aggregate_snapshot_json jsonb not null default '{}'::jsonb,
  briefing_json jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (
    status in ('new', 'acknowledged', 'action_taken', 'follow_up', 'closed')
  ),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  follow_up_on date,
  -- Idempotency key for worker retries:
  constraint uq_welfare_report_retry unique (unit_id, week_start, trigger_rule)
);

-- At most ONE active report per unit (enforced via partial unique index)
create unique index if not exists idx_welfare_reports_active_per_unit
  on public.welfare_reports (unit_id)
  where (status not in ('closed'));

create index if not exists idx_welfare_reports_assigned_status
  on public.welfare_reports (assigned_to, status, created_at desc);

create index if not exists idx_welfare_reports_unit
  on public.welfare_reports (unit_id, created_at desc);


-- ==============================================================================
-- 4. PRIVATE BREAK-GLASS ACCESS GRANTS & AUDIT TABLES
-- ==============================================================================

-- 4.1 Access Grants Table (Time-limited exceptional read grant)
create table if not exists private.access_grants (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.welfare_reports(id) on delete cascade,
  officer_id uuid not null references auth.users(id) on delete restrict,
  unit_id text not null references private.units(id) on delete restrict,
  reason_code text not null check (reason_code in ('welfare_review', 'roster_audit', 'safety_check')),
  encrypted_reason text not null check (length(encrypted_reason) >= 10),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint chk_grant_duration check (expires_at > created_at)
);

create index if not exists idx_access_grants_lookup
  on private.access_grants (officer_id, report_id, expires_at);

-- 4.2 Access Audit Log (Immutable record of every individual read)
create table if not exists private.access_audit (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references private.access_grants(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  report_id uuid not null references public.welfare_reports(id) on delete cascade,
  action text not null default 'individual_read',
  row_count integer not null default 0 check (row_count >= 0 and row_count <= 20),
  occurred_at timestamptz not null default now()
);

create index if not exists idx_access_audit_actor
  on private.access_audit (actor_id, occurred_at desc);

create index if not exists idx_access_audit_report
  on private.access_audit (report_id, occurred_at desc);


-- ==============================================================================
-- 5. RLS HELPER FUNCTIONS (Security Definer to prevent infinite recursion)
-- ==============================================================================

create or replace function public.current_user_has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = required_role
  );
$$;

create or replace function public.current_user_has_any_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = any(required_roles)
  );
$$;

create or replace function public.current_user_assigned_to_unit(target_unit_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.unit_assignments
    where user_id = auth.uid()
      and unit_id = target_unit_id
  );
$$;


-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 6.1 Enable RLS on all client-facing public tables
alter table public.user_roles enable row level security;
alter table public.unit_assignments enable row level security;
alter table public.unit_week_releases enable row level security;
alter table public.welfare_reports enable row level security;

-- Also enable RLS on private tables as defense-in-depth
alter table private.access_grants enable row level security;
alter table private.access_audit enable row level security;

-- 6.2 user_roles RLS policies:
-- Only authenticated users can see their own role. No client-side INSERT/UPDATE/DELETE.
drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

-- 6.3 unit_assignments RLS policies:
-- Only authenticated users can see their own unit assignments. No client-side INSERT/UPDATE/DELETE.
drop policy if exists unit_assignments_self_read on public.unit_assignments;
create policy unit_assignments_self_read
  on public.unit_assignments
  for select
  to authenticated
  using (user_id = auth.uid());

-- 6.4 unit_week_releases RLS policies:
-- Authenticated users with allowed roles ('commander', 'welfare_officer', 'system_admin')
-- can SELECT only releases for their assigned units.
-- No client-side writes.
drop policy if exists unit_week_releases_select on public.unit_week_releases;
create policy unit_week_releases_select
  on public.unit_week_releases
  for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_user_has_any_role(array['commander', 'welfare_officer', 'system_admin'])
    and public.current_user_assigned_to_unit(unit_id)
  );

-- 6.5 welfare_reports RLS policies:
-- Only the assigned welfare officer can SELECT and UPDATE the report.
-- Commanders CANNOT view welfare reports under any circumstances.
drop policy if exists welfare_reports_select on public.welfare_reports;
create policy welfare_reports_select
  on public.welfare_reports
  for select
  to authenticated
  using (
    auth.uid() is not null
    and assigned_to = auth.uid()
    and public.current_user_has_role('welfare_officer')
  );

drop policy if exists welfare_reports_update on public.welfare_reports;
create policy welfare_reports_update
  on public.welfare_reports
  for update
  to authenticated
  using (
    auth.uid() is not null
    and assigned_to = auth.uid()
    and public.current_user_has_role('welfare_officer')
  )
  with check (
    auth.uid() is not null
    and assigned_to = auth.uid()
    and public.current_user_has_role('welfare_officer')
  );


-- ==============================================================================
-- 7. SQL GRANTS & PERMISSIONS (Enforcing Principle of Least Privilege)
-- ==============================================================================

-- Revoke all table privileges from public and anon
revoke all on public.user_roles from public, anon;
revoke all on public.unit_assignments from public, anon;
revoke all on public.unit_week_releases from public, anon;
revoke all on public.welfare_reports from public, anon;

-- Grant minimal necessary read/write to authenticated users
grant select on public.user_roles to authenticated;
grant select on public.unit_assignments to authenticated;
grant select on public.unit_week_releases to authenticated;
grant select, update (status, acknowledged_at, follow_up_on) on public.welfare_reports to authenticated;

-- Disallow client-side mutations on roles, assignments, releases, and reports creation/deletion
revoke insert, update, delete on public.user_roles from authenticated;
revoke insert, update, delete on public.unit_assignments from authenticated;
revoke insert, update, delete on public.unit_week_releases from authenticated;
revoke insert, delete on public.welfare_reports from authenticated;

-- Grant full operational privileges to service_role (backend worker)
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all tables in schema private to service_role;


-- ==============================================================================
-- 8. NARROW ROLE PROVISIONING PROCESS (Service-Role Only)
-- ==============================================================================

create or replace function public.provision_user_role(
  p_user_id uuid,
  p_role text,
  p_unit_ids text[] default array[]::text[]
)
returns boolean
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  u_id text;
begin
  -- Validate target role
  if p_role not in ('commander', 'welfare_officer', 'hr_uploader', 'system_admin') then
    raise exception 'Invalid role requested: %', p_role;
  end if;

  -- Validate that user exists in auth.users
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User ID % not found in auth.users', p_user_id;
  end if;

  -- Upsert role
  insert into public.user_roles (user_id, role, updated_at)
  values (p_user_id, p_role, now())
  on conflict (user_id) do update
    set role = excluded.role,
        updated_at = now();

  -- Assign units if provided
  if array_length(p_unit_ids, 1) > 0 then
    foreach u_id in array p_unit_ids
    loop
      if not exists (select 1 from private.units where id = u_id) then
        raise exception 'Unit % does not exist', u_id;
      end if;

      insert into public.unit_assignments (user_id, unit_id, assigned_at)
      values (p_user_id, u_id, now())
      on conflict (user_id, unit_id) do nothing;
    end loop;
  end if;

  return true;
end;
$$;

-- Restrict execution to service_role and superuser only
revoke all on function public.provision_user_role(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.provision_user_role(uuid, text, text[]) to service_role;


-- ==============================================================================
-- 9. TRANSACTIONAL AUDITED BREAK-GLASS FUNCTION (Service-Role Only)
-- ==============================================================================
-- Note: As specified in docs/09-database-design.md, individual reads do NOT use
-- ordinary SELECT. They require a transactional function that checks the active
-- grant, records an audit event, and returns at most 20 pseudonymous rows.

create or replace function private.execute_audited_break_glass_read(
  p_grant_id uuid,
  p_officer_id uuid,
  p_report_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  personnel_id text,
  unit_id text,
  history_start_on date,
  recent_leave_status text,
  night_shifts_count bigint,
  recorded_duty_hours numeric
)
language plpgsql
security definer
set search_path = private, public, auth, pg_temp
as $$
declare
  v_grant private.access_grants%rowtype;
  v_returned_count integer := 0;
begin
  -- 1. Clamp limit to max 20 rows per specification
  if p_limit > 20 then
    p_limit := 20;
  elsif p_limit < 1 then
    p_limit := 1;
  end if;

  -- 2. Verify active grant exists and has not expired
  select * into v_grant
  from private.access_grants
  where id = p_grant_id
    and officer_id = p_officer_id
    and report_id = p_report_id
    and expires_at > now();

  if not found then
    raise exception 'Valid unexpired access grant not found for officer % and report %', p_officer_id, p_report_id;
  end if;

  -- 3. Verify officer has active welfare_officer role
  if not exists (
    select 1 from public.user_roles where user_id = p_officer_id and role = 'welfare_officer'
  ) then
    raise exception 'Actor % is not an authorized welfare officer', p_officer_id;
  end if;

  -- 4. Verify welfare report assignment
  if not exists (
    select 1 from public.welfare_reports where id = p_report_id and assigned_to = p_officer_id
  ) then
    raise exception 'Report % is not assigned to officer %', p_report_id, p_officer_id;
  end if;

  -- 5. Prepare pseudonymous dataset for the unit
  -- Return limited set and record audit row
  return query
  with unit_persons as (
    select p.id as p_id, p.unit_id as p_unit_id, p.history_start_on as p_history_start
    from private.personnel p
    where p.unit_id = v_grant.unit_id and p.active = true
    order by p.id
    limit p_limit offset p_offset
  ),
  person_metrics as (
    select
      up.p_id,
      up.p_unit_id,
      up.p_history_start,
      coalesce((
        select lr.status
        from private.leave_records lr
        where lr.personnel_id = up.p_id
        order by lr.end_on desc limit 1
      ), 'none') as recent_leave,
      coalesce((
        select count(*)
        from private.duty_records dr
        where dr.personnel_id = up.p_id
          and dr.shift_type = 'night'
          and dr.duty_date >= (current_date - interval '28 days')
      ), 0) as night_shifts,
      coalesce((
        select sum(dr.hours)
        from private.duty_records dr
        where dr.personnel_id = up.p_id
          and dr.duty_date >= (current_date - interval '7 days')
      ), 0.0) as recent_hours
    from unit_persons up
  )
  select
    pm.p_id,
    pm.p_unit_id,
    pm.p_history_start,
    pm.recent_leave,
    pm.night_shifts,
    pm.recent_hours
  from person_metrics pm;

  get diagnostics v_returned_count = row_count;

  -- 6. Insert audit log row inside the same transaction
  insert into private.access_audit (grant_id, actor_id, report_id, action, row_count, occurred_at)
  values (p_grant_id, p_officer_id, p_report_id, 'individual_read', v_returned_count, now());

end;
$$;

revoke all on function private.execute_audited_break_glass_read(uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function private.execute_audited_break_glass_read(uuid, uuid, uuid, integer, integer) to service_role;

-- ==============================================================================
-- 10. ARCHITECTURAL NOTE ON MATERIALIZED VIEWS
-- ==============================================================================
-- In PostgreSQL, materialized views do NOT support Row-Level Security (RLS).
-- Attempting to run 'alter materialized view ... enable row level security' causes
-- an error (ERROR: "..." is not a table).
--
-- Therefore, if internal performance aggregation materialized views are created,
-- they MUST be placed strictly in schema 'private' (which has USAGE revoked from
-- public/anon/authenticated), and the resulting data must be published into
-- public.unit_week_releases via the privacy-preserving release pipeline.
-- ==============================================================================
