-- ==============================================================================
-- Migration: 20260930160000_phase7_import_and_hardening.sql
-- Unit Pulse 2.0 — Phase 7: Restricted Synthetic Import & Hardening
-- Specifications: docs/06-data-specification.md, docs/09-database-design.md,
--                 docs/10-security-privacy.md, docs/11-testing-plan.md, docs/14-risk-register.md
--
-- NON-NEGOTIABLE PRINCIPLES:
-- 1. SYNTHETIC RECORDS ONLY: Real uniformed-force data is strictly prohibited.
-- 2. PRIVATE SCHEMA ISOLATION: Browser roles (anon, authenticated, commander,
--    welfare_officer) have zero direct SELECT or INSERT on private source tables.
-- 3. TRANSACTIONAL ATOMICITY: Batch imports must be atomic; any invalid record,
--    bad date, duplicate, or constraint failure rolls back the entire batch.
-- 4. NO GENERIC ADMIN BROWSER: Only specific domain ingestion routines are exposed.
-- ==============================================================================

-- 1. Ensure private schema tables have all necessary indexes for fast validation
create index if not exists idx_private_personnel_history
  on private.personnel (history_start_on);

create index if not exists idx_private_leave_records_person_status
  on private.leave_records (personnel_id, status);

create index if not exists idx_private_duty_records_person_date
  on private.duty_records (personnel_id, duty_date);

-- 2. Secure transactional import function for server-side ingestion
create or replace function private.execute_transactional_import(
  p_dataset_type text,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare
  v_inserted_count integer := 0;
  v_record jsonb;
begin
  -- Restrict execution strictly to service_role or superuser
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'access_denied: Only service_role can execute transactional source imports.';
  end if;

  if p_records is null or jsonb_array_length(p_records) = 0 then
    return jsonb_build_object('success', true, 'dataset_type', p_dataset_type, 'inserted_count', 0);
  end if;

  case p_dataset_type
    when 'units' then
      for v_record in select * from jsonb_array_elements(p_records)
      loop
        insert into private.units (id, display_code, name, active)
        values (
          v_record->>'id',
          v_record->>'display_code',
          v_record->>'name',
          coalesce((v_record->>'active')::boolean, true)
        );
        v_inserted_count := v_inserted_count + 1;
      end loop;

    when 'personnel' then
      for v_record in select * from jsonb_array_elements(p_records)
      loop
        insert into private.personnel (id, unit_id, active, history_start_on)
        values (
          v_record->>'id',
          v_record->>'unit_id',
          coalesce((v_record->>'active')::boolean, true),
          (v_record->>'history_start_on')::date
        );
        v_inserted_count := v_inserted_count + 1;
      end loop;

    when 'leave_eligibility' then
      for v_record in select * from jsonb_array_elements(p_records)
      loop
        insert into private.leave_eligibility (personnel_id, snapshot_week, eligible_days_90d, verified)
        values (
          v_record->>'personnel_id',
          (v_record->>'snapshot_week')::date,
          (v_record->>'eligible_days_90d')::integer,
          coalesce((v_record->>'verified')::boolean, true)
        );
        v_inserted_count := v_inserted_count + 1;
      end loop;

    when 'leave_records' then
      for v_record in select * from jsonb_array_elements(p_records)
      loop
        insert into private.leave_records (id, personnel_id, status, start_on, end_on, qualifying, decided_on)
        values (
          v_record->>'id',
          v_record->>'personnel_id',
          v_record->>'status',
          (v_record->>'start_on')::date,
          (v_record->>'end_on')::date,
          coalesce((v_record->>'qualifying')::boolean, true),
          case when v_record->>'decided_on' is not null and v_record->>'decided_on' <> ''
               then (v_record->>'decided_on')::date else null end
        );
        v_inserted_count := v_inserted_count + 1;
      end loop;

    when 'duty_records' then
      for v_record in select * from jsonb_array_elements(p_records)
      loop
        insert into private.duty_records (personnel_id, duty_date, shift_type, hours)
        values (
          v_record->>'personnel_id',
          (v_record->>'duty_date')::date,
          v_record->>'shift_type',
          (v_record->>'hours')::numeric
        );
        v_inserted_count := v_inserted_count + 1;
      end loop;

    when 'deployments' then
      for v_record in select * from jsonb_array_elements(p_records)
      loop
        insert into private.deployments (id, personnel_id, start_on, end_on, verified)
        values (
          v_record->>'id',
          v_record->>'personnel_id',
          (v_record->>'start_on')::date,
          case when v_record->>'end_on' is not null and v_record->>'end_on' <> ''
               then (v_record->>'end_on')::date else null end,
          coalesce((v_record->>'verified')::boolean, true)
        );
        v_inserted_count := v_inserted_count + 1;
      end loop;

    else
      raise exception 'unsupported_dataset_type: %', p_dataset_type;
  end case;

  return jsonb_build_object(
    'success', true,
    'dataset_type', p_dataset_type,
    'inserted_count', v_inserted_count
  );
end;
$$;

-- 3. Explicit privilege grants
revoke all on function private.execute_transactional_import(text, jsonb) from public;
revoke all on function private.execute_transactional_import(text, jsonb) from anon;
revoke all on function private.execute_transactional_import(text, jsonb) from authenticated;
grant execute on function private.execute_transactional_import(text, jsonb) to service_role;
