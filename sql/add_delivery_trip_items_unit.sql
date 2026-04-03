-- รันครั้งเดียวบน Supabase (SQL Editor) หรือผ่าน supabase db push หลังมี migration
-- แก้ PGRST204: Could not find the 'unit' column of 'delivery_trip_items'

ALTER TABLE public.delivery_trip_items
  ADD COLUMN IF NOT EXISTS unit text;

COMMENT ON COLUMN public.delivery_trip_items.unit IS 'หน่วยจากบรรทัดออเดอร์ (order_items.unit); ถ้า null ให้ UI fallback ไป products.unit';
