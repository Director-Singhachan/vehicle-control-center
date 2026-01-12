-- Check for delivery trips without trip_number
-- This query helps identify trips that are missing their auto-generated trip codes

SELECT 
  dt.id,
  dt.trip_number,
  dt.sequence_order,
  dt.planned_date,
  dt.status,
  dt.created_at,
  v.plate as vehicle_plate,
  v.make || ' ' || v.model as vehicle_info,
  p.full_name as driver_name
FROM delivery_trips dt
LEFT JOIN vehicles v ON dt.vehicle_id = v.id
LEFT JOIN profiles p ON dt.driver_id = p.id
WHERE dt.trip_number IS NULL
ORDER BY dt.created_at DESC;

-- Count trips without trip_number
SELECT 
  COUNT(*) as trips_without_number,
  COUNT(CASE WHEN status = 'planned' THEN 1 END) as planned,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
FROM delivery_trips
WHERE trip_number IS NULL;
