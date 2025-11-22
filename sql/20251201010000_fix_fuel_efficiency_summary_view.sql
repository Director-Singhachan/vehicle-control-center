-- Fix fuel_efficiency_summary view
-- Issues fixed:
-- 1. Include all fuel records, not just those with fuel_efficiency (show fill_count and total_liters even if efficiency not calculated)
-- 2. Better handling of month filtering

-- Drop and recreate the view
drop view if exists public.fuel_efficiency_summary;

create or replace view public.fuel_efficiency_summary as
select 
  fr.vehicle_id,
  v.plate,
  v.make,
  v.model,
  date_trunc('month', fr.filled_at)::date as month,  -- Convert to date for easier filtering
  count(*) as fill_count,
  sum(fr.liters) as total_liters,
  sum(fr.total_cost) as total_cost,
  avg(fr.fuel_efficiency) filter (where fr.fuel_efficiency is not null) as avg_efficiency,
  min(fr.fuel_efficiency) filter (where fr.fuel_efficiency is not null) as min_efficiency,
  max(fr.fuel_efficiency) filter (where fr.fuel_efficiency is not null) as max_efficiency
from public.fuel_records fr
join public.vehicles v on v.id = fr.vehicle_id
group by fr.vehicle_id, v.plate, v.make, v.model, date_trunc('month', fr.filled_at);

-- Grant access to authenticated users
grant select on public.fuel_efficiency_summary to authenticated;

