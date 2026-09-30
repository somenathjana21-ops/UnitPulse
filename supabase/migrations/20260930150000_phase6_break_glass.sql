-- ==============================================================================
-- Migration: 20260930150000_phase6_break_glass.sql
-- Unit Pulse 2.0 — Phase 6: Exceptional Individual-Read Workflow & Auditing
-- Specifications: docs/04-user-flows.md, docs/08-api-specification.md,
--                 docs/09-database-design.md, docs/10-security-privacy.md,
--                 docs/11-testing-plan.md
--
-- NON-NEGOTIABLE PRINCIPLES:
-- 1. Private raw tables remain completely unexposed to browser clients.
-- 2. Ordinary client SELECT on private records is NEVER granted.
-- 3. Access requires an assigned welfare report, reason code, and typed reason.
-- 4. Server-enforced 30-minute grant duration; client cannot override expiry.
-- 5. Stored reasons are encrypted server-side with AES-256-GCM.
-- 6. Narrow transactional database read function checks officer/report/unit/grant/expiry,
--    records an audit event, and returns at most 20 pseudonymous records per page.
-- 7. Audit log is immutable and per-read.
-- 8. Officer audit viewer allows officers to inspect their own access history only.
-- ==============================================================================

-- 1. Align reason code constraints on private.access_grants
alter table private.access_grants drop constraint if exists access_grants_reason_code_check;
alter table private.access_grants add constraint access_grants_reason_code_check
  check (reason_code in (
    'welfare_review',
    'roster_audit',
    'safety_check',
    'leave_rebalancing_assessment',
    'emergency_support'
  ));

-- 2. Transactional Grant Creation Function (Service-Role Only)
create or replace function private.create_access_grant(
  p_report_id uuid,
  p_officer_id uuid,
  p_reason_code text,
  p_encrypted_reason text
)
returns table (
  id uuid,
  report_id uuid,
  officer_id uuid,
  unit_id text,
  reason_code text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = private, public, auth, pg_temp
as $$
declare
  v_unit_id text;
  v_grant_id uuid;
  v_created_at timestamptz := now();
  v_expires_at timestamptz := now() + interval '30 minutes';
begin
  -- 2.1 Verify officer has welfare_officer role
  if not exists (
    select 1 from public.user_roles where user_id = p_officer_id and role = 'welfare_officer'
  ) then
    raise exception 'Actor % is not an authorized welfare officer', p_officer_id;
  end if;

  -- 2.2 Verify report exists and is assigned to this officer
  select r.unit_id into v_unit_id
  from public.welfare_reports r
  where r.id = p_report_id
    and r.assigned_to = p_officer_id;

  if not found then
    raise exception 'Welfare report % not found or not assigned to officer %', p_report_id, p_officer_id;
  end if;

  -- 2.3 Verify reason parameters
  if p_reason_code not in ('welfare_review', 'roster_audit', 'safety_check', 'leave_rebalancing_assessment', 'emergency_support') then
    raise exception 'Invalid reason code: %', p_reason_code;
  end if;

  if length(p_encrypted_reason) < 10 then
    raise exception 'Encrypted reason payload is invalid';
  end if;

  -- 2.4 Insert grant with strict 30-minute expiry
  insert into private.access_grants (
    report_id,
    officer_id,
    unit_id,
    reason_code,
    encrypted_reason,
    expires_at,
    created_at
  )
  values (
    p_report_id,
    p_officer_id,
    v_unit_id,
    p_reason_code,
    p_encrypted_reason,
    v_expires_at,
    v_created_at
  )
  returning private.access_grants.id into v_grant_id;

  -- 2.5 Log grant creation event in immutable access audit log
  insert into private.access_audit (
    grant_id,
    actor_id,
    report_id,
    action,
    row_count,
    occurred_at
  )
  values (
    v_grant_id,
    p_officer_id,
    p_report_id,
    'grant_requested',
    0,
    v_created_at
  );

  return query
  select
    g.id,
    g.report_id,
    g.officer_id,
    g.unit_id,
    g.reason_code,
    g.expires_at,
    g.created_at
  from private.access_grants g
  where g.id = v_grant_id;
end;
$$;

revoke all on function private.create_access_grant(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function private.create_access_grant(uuid, uuid, text, text) to service_role;


-- 3. Narrow Transactional Database Read Function (Service-Role Only)
-- Rechecks officer, report, unit, grant, and expiry in one atomic transaction.
-- Writes audit row and returns at most 20 pseudonymous records.
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
  v_report public.welfare_reports%rowtype;
  v_returned_count integer := 0;
begin
  -- 3.1 Clamp limit to max 20 rows per specification
  if p_limit is null or p_limit > 20 then
    p_limit := 20;
  elsif p_limit < 1 then
    p_limit := 1;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  -- 3.2 Verify officer has active welfare_officer role
  if not exists (
    select 1 from public.user_roles where user_id = p_officer_id and role = 'welfare_officer'
  ) then
    raise exception 'Actor % is not an authorized welfare officer', p_officer_id;
  end if;

  -- 3.3 Verify welfare report exists and is assigned to this officer
  select * into v_report
  from public.welfare_reports
  where id = p_report_id and assigned_to = p_officer_id;

  if not found then
    raise exception 'Report % is not found or not assigned to officer %', p_report_id, p_officer_id;
  end if;

  -- 3.4 Verify active grant exists
  select * into v_grant
  from private.access_grants
  where id = p_grant_id
    and officer_id = p_officer_id
    and report_id = p_report_id;

  if not found then
    raise exception 'Access grant % not found for officer % and report %', p_grant_id, p_officer_id, p_report_id;
  end if;

  -- 3.5 Recheck unit consistency: report unit must match grant unit
  if v_grant.unit_id <> v_report.unit_id then
    raise exception 'Unit mismatch between grant (%) and report (%)', v_grant.unit_id, v_report.unit_id;
  end if;

  -- 3.6 Check grant expiration
  if v_grant.expires_at <= now() then
    raise exception 'Access grant % has expired at %', p_grant_id, v_grant.expires_at;
  end if;

  -- 3.7 Return up to 20 pseudonymous records
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

  -- 3.8 Atomically insert audit record in the same transaction
  insert into private.access_audit (
    grant_id,
    actor_id,
    report_id,
    action,
    row_count,
    occurred_at
  )
  values (
    p_grant_id,
    p_officer_id,
    p_report_id,
    'individual_read',
    v_returned_count,
    now()
  );

end;
$$;

revoke all on function private.execute_audited_break_glass_read(uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function private.execute_audited_break_glass_read(uuid, uuid, uuid, integer, integer) to service_role;


-- 4. Officer Audit Viewer Function (Service-Role Only)
-- Returns only the calling officer's own audit events, joined with unit and week details.
create or replace function private.get_officer_audit_log(
  p_officer_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  grant_id uuid,
  actor_id uuid,
  report_id uuid,
  unit_id text,
  week_start date,
  action text,
  row_count integer,
  reason_code text,
  occurred_at timestamptz
)
language plpgsql
security definer
set search_path = private, public, auth, pg_temp
as $$
begin
  -- 4.1 Verify officer has welfare_officer role
  if not exists (
    select 1 from public.user_roles where user_id = p_officer_id and role = 'welfare_officer'
  ) then
    raise exception 'Actor % is not an authorized welfare officer', p_officer_id;
  end if;

  if p_limit is null or p_limit > 100 then
    p_limit := 100;
  elsif p_limit < 1 then
    p_limit := 1;
  end if;

  -- 4.2 Query officer's own audit records
  return query
  select
    a.id,
    a.grant_id,
    a.actor_id,
    a.report_id,
    r.unit_id,
    r.week_start,
    a.action,
    a.row_count,
    coalesce(g.reason_code, 'unspecified') as reason_code,
    a.occurred_at
  from private.access_audit a
  inner join public.welfare_reports r on r.id = a.report_id
  left join private.access_grants g on g.id = a.grant_id
  where a.actor_id = p_officer_id
  order by a.occurred_at desc
  limit p_limit;
end;
$$;

revoke all on function private.get_officer_audit_log(uuid, integer) from public, anon, authenticated;
grant execute on function private.get_officer_audit_log(uuid, integer) to service_role;
