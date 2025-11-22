-- Add missing fields to support full migration from GAS to Supabase

-- Add garage field to tickets
alter table public.tickets 
  add column if not exists garage text;

-- Add inspector, manager, executive fields (for backward compatibility and quick access)
alter table public.tickets 
  add column if not exists inspector_name text,
  add column if not exists manager_name text,
  add column if not exists executive_name text;

-- Add formatted ticket number for business-friendly ID (e.g., 6810-001)
alter table public.tickets 
  add column if not exists ticket_number text;

-- Add approval history as JSONB for quick access (denormalized from ticket_approvals)
alter table public.tickets 
  add column if not exists approval_history jsonb default '[]'::jsonb;

-- Add signature URLs directly to tickets for backward compatibility
alter table public.tickets 
  add column if not exists inspector_signature_url text,
  add column if not exists inspector_signed_at timestamptz,
  add column if not exists manager_signature_url text,
  add column if not exists manager_signed_at timestamptz,
  add column if not exists executive_signature_url text,
  add column if not exists executive_signed_at timestamptz;

-- Add index for better query performance
create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_vehicle_id on public.tickets(vehicle_id);
create index if not exists idx_tickets_reporter_id on public.tickets(reporter_id);
create index if not exists idx_tickets_created_at on public.tickets(created_at desc);
create unique index if not exists idx_tickets_ticket_number on public.tickets(ticket_number) where ticket_number is not null;
create index if not exists idx_ticket_approvals_ticket_id on public.ticket_approvals(ticket_id);
create index if not exists idx_ticket_costs_ticket_id on public.ticket_costs(ticket_id);
create index if not exists idx_vehicles_plate on public.vehicles(plate);

-- Add function to update approval history when approval is added
create or replace function public.update_ticket_approval_history()
returns trigger language plpgsql as $$
begin
  update public.tickets
  set approval_history = (
    select jsonb_agg(
      jsonb_build_object(
        'id', id,
        'approver_id', approver_id,
        'role_at_approval', role_at_approval,
        'action', action,
        'comments', comments,
        'signature_url', signature_url,
        'created_at', created_at
      ) order by created_at
    )
    from public.ticket_approvals
    where ticket_id = new.ticket_id
  )
  where id = new.ticket_id;
  
  -- Also update signature URLs if provided
  if new.signature_url is not null then
    case new.role_at_approval
      when 'inspector' then
        update public.tickets
        set inspector_signature_url = new.signature_url,
            inspector_signed_at = new.created_at
        where id = new.ticket_id;
      when 'manager' then
        update public.tickets
        set manager_signature_url = new.signature_url,
            manager_signed_at = new.created_at
        where id = new.ticket_id;
      when 'executive' then
        update public.tickets
        set executive_signature_url = new.signature_url,
            executive_signed_at = new.created_at
        where id = new.ticket_id;
    end case;
  end if;
  
  return new;
end;
$$;

-- Create trigger to update approval history
drop trigger if exists trigger_update_approval_history on public.ticket_approvals;
create trigger trigger_update_approval_history
  after insert on public.ticket_approvals
  for each row execute function public.update_ticket_approval_history();

-- Add view for tickets with related data (for easier querying)
create or replace view public.tickets_with_relations as
select 
  t.*,
  v.plate as vehicle_plate,
  v.make,
  v.model,
  v.type as vehicle_type,
  v.branch,
  r.email as reporter_email,
  r.full_name as reporter_name,
  r.role as reporter_role
from public.tickets t
left join public.vehicles v on t.vehicle_id = v.id
left join public.profiles r on t.reporter_id = r.id;

