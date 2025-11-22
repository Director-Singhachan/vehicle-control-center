-- Create sequence for ticket numbers if it does not exist
create sequence if not exists public.ticket_number_seq
  increment by 1
  minvalue 1
  start 100001;

-- Function to generate formatted ticket numbers
create or replace function public.generate_ticket_number(prefix text default 'TCK', pad_length integer default 6)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    next_value bigint;
    formatted text;
begin
    select nextval('public.ticket_number_seq') into next_value;
    formatted := coalesce(nullif(trim(prefix), ''), 'TCK') || '-' ||
        lpad(next_value::text, greatest(1, least(pad_length, 12)), '0');
    return formatted;
end;
$$;

comment on function public.generate_ticket_number is
  'Generates a sequential, zero-padded ticket number with optional prefix.';

grant usage, select on sequence public.ticket_number_seq to authenticated, service_role;
grant execute on function public.generate_ticket_number(text, integer) to anon, authenticated, service_role;


