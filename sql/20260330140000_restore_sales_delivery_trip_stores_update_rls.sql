-- Sync with supabase/migrations/20260330140000_restore_sales_delivery_trip_stores_update_rls.sql

BEGIN;

DROP POLICY IF EXISTS "delivery_trip_stores_update" ON public.delivery_trip_stores;

CREATE POLICY "delivery_trip_stores_update"
ON public.delivery_trip_stores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse', 'sales')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'inspector', 'warehouse', 'sales')
  )
);

COMMENT ON POLICY "delivery_trip_stores_update" ON public.delivery_trip_stores IS
  'อนุญาตให้ admin, manager, inspector, warehouse, sales อัปเดต delivery_trip_stores (รวม invoice_status)';

COMMIT;
