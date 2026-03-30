-- คืนสิทธิ์ sales ใน delivery_trip_stores UPDATE (invoice_status)
-- migration 20260330120000 แทนที่ policy โดยไม่รวม sales จึงทำให้ฝ่ายขายอัปเดตสถานะออกบิลไม่ได้
-- อ้างอิงเดิม: sql/20260208000000_fix_sales_warehouses_and_orders_access.sql

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
