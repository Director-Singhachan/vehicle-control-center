-- Recalculate fuel efficiency for all vehicles
-- This migration should be run after fixing the trigger function
-- to recalculate fuel_efficiency for all existing records

-- Function to recalculate fuel efficiency for all vehicles
do $$
declare
  v_vehicle_id uuid;
begin
  -- Loop through all vehicles and recalculate
  for v_vehicle_id in
    select distinct vehicle_id
    from public.fuel_records
    where vehicle_id is not null
  loop
    -- Call the recalculate function for each vehicle
    perform public.recalculate_fuel_efficiency_for_vehicle(v_vehicle_id);
    
    raise notice 'Recalculated fuel efficiency for vehicle: %', v_vehicle_id;
  end loop;
  
  raise notice 'Finished recalculating fuel efficiency for all vehicles';
end $$;

