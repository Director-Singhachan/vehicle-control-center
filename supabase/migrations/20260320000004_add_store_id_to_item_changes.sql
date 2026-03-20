-- ============================================================
-- Add store_id to delivery_trip_item_changes
-- เหตุผล: delivery_trip_store_id FK ไปหา delivery_trip_stores ซึ่งถูกลบเมื่อลบร้าน
--         ทำให้ดึงชื่อร้านค้าจากประวัติไม่ได้ เพิ่ม store_id โดยตรงแก้ปัญหานี้
-- ============================================================

ALTER TABLE public.delivery_trip_item_changes
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.delivery_trip_item_changes.store_id IS
  'Direct reference to stores.id — preserved even after delivery_trip_stores row is deleted';
