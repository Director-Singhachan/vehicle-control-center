-- Migration: P&L Data Quality Rules, Alerting Views, and Audit Log for Sensitive Tables
-- Scope:
--   - Define audit logging for HR salaries and vehicle cost master data
--   - Expose P&L data-quality rules via anomaly views for Trip / Vehicle / Fleet
--   - Keep logic compatible with existing generic audit_logs implementation

-- ────────────────────────────────────────────────────────────────────────────────
-- 1. Generic Audit Log Table + Function (idempotent)
--    NOTE: This mirrors sql/20251115130000_add_audit_logs.sql so that
--          environments using Supabase migrations get the same structure.
-- ────────────────────────────────────────────────────────────────────────────────

create table if not exists public.audit_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  -- Source information
  table_name text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),

  -- Generic record identifier (supports bigint, uuid, etc.)
  record_id text,

  -- Who performed the change (JWT user)
  user_id uuid,

  -- Snapshot of row data (NEW for insert/update, OLD for delete)
  row_data jsonb,

  -- For updates: both old and new values for comparison
  changes jsonb
);

comment on table public.audit_logs is
  'Generic audit log for key tables (tickets, salaries, vehicle costs, allocations, etc.)';

create index if not exists idx_audit_logs_table_name
  on public.audit_logs(table_name);
create index if not exists idx_audit_logs_created_at
  on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_user_id
  on public.audit_logs(user_id);

-- Audit Logging Function (shared across audited tables)
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id text;
  v_user_id uuid;
  v_row_data jsonb;
  v_changes jsonb;
begin
  -- Snapshot row data first (avoid referencing non-existent fields)
  if (TG_OP = 'DELETE') then
    v_row_data := to_jsonb(OLD);
  else
    v_row_data := to_jsonb(NEW);
  end if;

  -- Determine record id from JSON (prefer "id", then common foreign keys)
  v_record_id := coalesce(
    v_row_data ->> 'id',
    v_row_data ->> 'ticket_id',
    v_row_data ->> 'staff_id',
    v_row_data ->> 'vehicle_id'
  );

  -- Capture caller user id from JWT, if available
  v_user_id := auth.uid();

  -- For UPDATE, store both old and new
  if (TG_OP = 'UPDATE') then
    v_changes := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  else
    v_changes := null;
  end if;

  insert into public.audit_logs (
    table_name,
    operation,
    record_id,
    user_id,
    row_data,
    changes
  ) values (
    TG_TABLE_NAME,
    TG_OP,
    v_record_id,
    v_user_id,
    v_row_data,
    v_changes
  );

  if (TG_OP = 'DELETE') then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

-- Attach/refresh triggers for existing ticket tables (for completeness)
drop trigger if exists audit_tickets on public.tickets;
create trigger audit_tickets
after insert or update or delete on public.tickets
for each row execute function public.log_audit();

drop trigger if exists audit_ticket_approvals on public.ticket_approvals;
create trigger audit_ticket_approvals
after insert or update or delete on public.ticket_approvals
for each row execute function public.log_audit();

-- ────────────────────────────────────────────────────────────────────────────────
-- 2. Audit Triggers for Sensitive P&L Master Data
--    - staff_salaries (HR)
--    - vehicle_fixed_costs / vehicle_variable_costs (Accounting/Operations)
--    - cost_allocation_rules (allocation model governance)
-- ────────────────────────────────────────────────────────────────────────────────

drop trigger if exists audit_staff_salaries on public.staff_salaries;
create trigger audit_staff_salaries
after insert or update or delete on public.staff_salaries
for each row execute function public.log_audit();

drop trigger if exists audit_vehicle_fixed_costs on public.vehicle_fixed_costs;
create trigger audit_vehicle_fixed_costs
after insert or update or delete on public.vehicle_fixed_costs
for each row execute function public.log_audit();

drop trigger if exists audit_vehicle_variable_costs on public.vehicle_variable_costs;
create trigger audit_vehicle_variable_costs
after insert or update or delete on public.vehicle_variable_costs
for each row execute function public.log_audit();

drop trigger if exists audit_cost_allocation_rules on public.cost_allocation_rules;
create trigger audit_cost_allocation_rules
after insert or update or delete on public.cost_allocation_rules
for each row execute function public.log_audit();

-- Row Level Security for audit_logs
alter table public.audit_logs enable row level security;

-- Allow inserts from authenticated clients (used by triggers in API context)
drop policy if exists "audit_logs insert any" on public.audit_logs;
create policy "audit_logs insert any"
on public.audit_logs
for insert
to authenticated
with check (true);

-- Admins (role = admin) can read all audit logs
drop policy if exists "audit_logs admin read" on public.audit_logs;
create policy "audit_logs admin read"
on public.audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- Owners can read their own audit entries (by user_id)
drop policy if exists "audit_logs owner read" on public.audit_logs;
create policy "audit_logs owner read"
on public.audit_logs
for select
to authenticated
using (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────────────────────────
-- 3. P&L Data Quality / Anomaly Views
--    These views implement business rules for "data issues" that should surface
--    in dashboards or a dedicated Data Issues page.
-- ────────────────────────────────────────────────────────────────────────────────

-- Helper enum-like text constants (documented in comments):
--   issue_code examples:
--     - 'TRIP_NO_REVENUE_WITH_COST'
--     - 'TRIP_MARGIN_BELOW_THRESHOLD'
--     - 'TRIP_IDLE_COST_HIGH_SHARE'
--     - 'VEHICLE_IDLE_COST_HIGH_SHARE'
--     - 'VEHICLE_MARGIN_BELOW_THRESHOLD'
--     - 'FLEET_MARGIN_BELOW_THRESHOLD'

-- Use CASCADE to allow reruns when pnl_data_issues already depends on this view
drop view if exists public.pnl_trip_anomalies cascade;
create view public.pnl_trip_anomalies as
select
  t.id as pnl_trip_id,
  t.delivery_trip_id,
  t.vehicle_id,
  t.branch,
  t.period_start,
  t.period_end,
  t.revenue,
  t.fixed_cost_allocated,
  t.variable_cost,
  t.idle_cost,
  t.total_cost,
  t.profit,
  t.margin_percent,
  t.flags,
  issue.issue_code,
  issue.severity,
  issue.message
from public.pnl_trip t
cross join lateral (
  select *
  from (
    values
      -- Rule: ทริปที่มีต้นทุนแต่ไม่มีรายได้ → เสี่ยงบันทึกผิดหรือ revenue ไม่ถูกดึงเข้า
      (case
         when (t.revenue is null or t.revenue <= 0)
              and (t.total_cost > 0)
         then 'TRIP_NO_REVENUE_WITH_COST'
         else null
       end,
       'warning',
       'Trip has cost but zero/negative revenue'),
      -- Rule: กำไรติดลบและ Margin ต่ำกว่าที่กำหนด (เช่น -30% ลงไป) → ควรตรวจสอบ
      (case
         when t.margin_percent is not null
              and t.margin_percent < -0.3
         then 'TRIP_MARGIN_BELOW_THRESHOLD'
         else null
       end,
       'error',
       'Trip margin is below -30%'),
      -- Rule: Idle cost สูงกว่าครึ่งหนึ่งของต้นทุนรวม → อาจเป็นธุรกิจไม่คุ้ม/ข้อมูลผิด
      (case
         when t.total_cost > 0
              and t.idle_cost > (t.total_cost * 0.5)
         then 'TRIP_IDLE_COST_HIGH_SHARE'
         else null
       end,
       'warning',
       'Idle cost is more than 50% of total trip cost')
  ) as r(issue_code, severity, message)
) as issue
where issue.issue_code is not null;

comment on view public.pnl_trip_anomalies is
  'Business-rule-based anomalies for trip-level P&L (pnl_trip) for Data Quality dashboards.';

alter view public.pnl_trip_anomalies
  set (security_invoker = on);


drop view if exists public.pnl_vehicle_anomalies cascade;
create view public.pnl_vehicle_anomalies as
select
  v.id as pnl_vehicle_id,
  v.vehicle_id,
  v.branch,
  v.period_start,
  v.period_end,
  v.revenue,
  v.fixed_cost,
  v.variable_cost,
  v.idle_cost,
  v.total_cost,
  v.profit,
  v.margin_percent,
  v.flags,
  issue.issue_code,
  issue.severity,
  issue.message
from public.pnl_vehicle v
cross join lateral (
  select *
  from (
    -- Rule: Idle cost > 60% ของต้นทุนรวมทั้งช่วง → แสดงให้ผู้จัดการเห็นรถจอดทิ้งมาก
    values
      (case
         when v.total_cost > 0
              and v.idle_cost > (v.total_cost * 0.6)
         then 'VEHICLE_IDLE_COST_HIGH_SHARE'
         else null
       end,
       'warning',
       'Vehicle idle cost is more than 60% of total cost'),
      -- Rule: Margin ต่ำกว่า 0% → ขาดทุนรวมทั้งช่วง
      (case
         when v.margin_percent is not null
              and v.margin_percent < 0
         then 'VEHICLE_MARGIN_BELOW_THRESHOLD'
         else null
       end,
       'error',
       'Vehicle margin is below 0% for the period')
  ) as r(issue_code, severity, message)
) as issue
where issue.issue_code is not null;

comment on view public.pnl_vehicle_anomalies is
  'Business-rule-based anomalies for vehicle-level P&L (pnl_vehicle) for Data Quality dashboards.';

alter view public.pnl_vehicle_anomalies
  set (security_invoker = on);


drop view if exists public.pnl_fleet_anomalies cascade;
create view public.pnl_fleet_anomalies as
select
  f.id as pnl_fleet_id,
  f.scope_type,
  f.scope_key,
  f.period_start,
  f.period_end,
  f.total_revenue,
  f.total_cost,
  f.profit,
  f.margin_percent,
  f.flags,
  issue.issue_code,
  issue.severity,
  issue.message
from public.pnl_fleet f
cross join lateral (
  select *
  from (
    values
      -- Rule: Margin ต่ำกว่าเป้าหมาย (เช่น 5%) ระดับ Fleet/Branch
      (case
         when f.margin_percent is not null
              and f.margin_percent < 0.05
         then 'FLEET_MARGIN_BELOW_THRESHOLD'
         else null
       end,
       'warning',
       'Fleet margin is below 5% for the period')
  ) as r(issue_code, severity, message)
) as issue
where issue.issue_code is not null;

comment on view public.pnl_fleet_anomalies is
  'Business-rule-based anomalies for fleet/company-level P&L (pnl_fleet) for Data Quality dashboards.';

alter view public.pnl_fleet_anomalies
  set (security_invoker = on);


-- 3.4 Consolidated Data Issues view (for UI to consume)
drop view if exists public.pnl_data_issues;
create view public.pnl_data_issues as
select
  'trip'::text as level,
  a.issue_code,
  a.severity,
  a.message,
  a.branch,
  a.period_start,
  a.period_end,
  a.pnl_trip_id as source_id,
  a.delivery_trip_id,
  a.vehicle_id,
  a.flags
from public.pnl_trip_anomalies a

union all

select
  'vehicle'::text as level,
  a.issue_code,
  a.severity,
  a.message,
  a.branch,
  a.period_start,
  a.period_end,
  a.pnl_vehicle_id as source_id,
  null::uuid as delivery_trip_id,
  a.vehicle_id,
  a.flags
from public.pnl_vehicle_anomalies a

union all

select
  'fleet'::text as level,
  a.issue_code,
  a.severity,
  a.message,
  null::text as branch, -- branch/scope will be encoded in scope_type/scope_key
  a.period_start,
  a.period_end,
  a.pnl_fleet_id as source_id,
  null::uuid as delivery_trip_id,
  null::uuid as vehicle_id,
  a.flags
from public.pnl_fleet_anomalies a;

comment on view public.pnl_data_issues is
  'Unified view of P&L data quality issues across Trip / Vehicle / Fleet levels for alerting and dashboards.';

alter view public.pnl_data_issues
  set (security_invoker = on);

