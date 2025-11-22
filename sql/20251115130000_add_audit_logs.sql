-- ========================================
-- Audit Log Table + Triggers + RLS
-- Logs INSERT/UPDATE/DELETE for tickets and ticket_approvals
-- ========================================

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

comment on table public.audit_logs is 'Generic audit log for key tables (tickets, ticket_approvals, etc.)';

-- Basic indexes for querying
create index if not exists idx_audit_logs_table_name on public.audit_logs(table_name);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);

-- ========================================
-- Audit Logging Function
-- ========================================

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

  -- Determine record id from JSON (prefer "id", then "ticket_id")
  v_record_id := coalesce(
    v_row_data ->> 'id',
    v_row_data ->> 'ticket_id'
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

-- ========================================
-- Attach Triggers to Key Tables
-- ========================================

drop trigger if exists audit_tickets on public.tickets;
create trigger audit_tickets
after insert or update or delete on public.tickets
for each row execute function public.log_audit();

drop trigger if exists audit_ticket_approvals on public.ticket_approvals;
create trigger audit_ticket_approvals
after insert or update or delete on public.ticket_approvals
for each row execute function public.log_audit();

-- ========================================
-- Row Level Security for audit_logs
-- - Admins can read all
-- - Owners can read their own entries (by user_id)
-- - Inserts are allowed from application roles via triggers
-- ========================================

alter table public.audit_logs enable row level security;

-- Allow inserts from authenticated clients (used by triggers in API context)
drop policy if exists "audit_logs insert any" on public.audit_logs;
create policy "audit_logs insert any"
on public.audit_logs
for insert
to authenticated
with check (true);

-- Admin can read all audit logs
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

-- Owners can read their own audit logs
drop policy if exists "audit_logs owner read" on public.audit_logs;
create policy "audit_logs owner read"
on public.audit_logs
for select
to authenticated
using (user_id = auth.uid());


