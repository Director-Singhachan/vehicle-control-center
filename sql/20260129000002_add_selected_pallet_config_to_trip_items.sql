-- ===================================================================
-- Phase 0: เพิ่มฟีเจอร์เลือก Pallet Configuration ต่อ Trip Item
-- ===================================================================
-- เป้าหมาย: ให้ user เลือกว่าจะใช้ pallet config ไหนสำหรับสินค้าแต่ละรายการในทริป
-- ตัวอย่าง: น้ำดื่ม 120 ลัง → เลือกระหว่าง "60 ลัง/พาเลท" หรือ "75 ลัง/พาเลท"

-- เพิ่มคอลัมน์เก็บ pallet config ที่เลือกใช้
ALTER TABLE public.delivery_trip_items
ADD COLUMN IF NOT EXISTS selected_pallet_config_id UUID REFERENCES public.product_pallet_configs(id) ON DELETE SET NULL;

-- Comment
COMMENT ON COLUMN public.delivery_trip_items.selected_pallet_config_id IS 
'Pallet configuration ที่ user เลือกใช้สำหรับ item นี้ (เช่น 60 ลัง vs 75 ลัง). ถ้าเป็น NULL จะใช้ default config ของสินค้า';

-- Index สำหรับ query ที่เกี่ยวข้อง
CREATE INDEX IF NOT EXISTS idx_delivery_trip_items_selected_config 
ON public.delivery_trip_items(selected_pallet_config_id);

-- ===================================================================
-- ตัวอย่างการใช้งาน
-- ===================================================================

-- Case 1: User เลือก config "อัดเต็ม 75 ลัง" สำหรับน้ำดื่ม
-- INSERT INTO delivery_trip_items (
--   delivery_trip_store_id,
--   product_id, 
--   quantity,
--   selected_pallet_config_id  -- เลือก config "75 ลัง"
-- ) VALUES (
--   'store-1',
--   'product-water-id',
--   120,
--   'config-75-units-id'
-- );

-- Case 2: ไม่เลือก config (ใช้ default)
-- INSERT INTO delivery_trip_items (
--   delivery_trip_store_id,
--   product_id, 
--   quantity,
--   selected_pallet_config_id  -- NULL = ใช้ default
-- ) VALUES (
--   'store-1',
--   'product-beer-id',
--   48,
--   NULL
-- );

-- ===================================================================
-- Query ตัวอย่าง: ดูข้อมูล trip พร้อม config ที่เลือก
-- ===================================================================

-- SELECT 
--   dti.id,
--   p.product_name,
--   dti.quantity,
--   ppc.pallet_id,
--   ppc.total_units as units_per_pallet,
--   CEIL(dti.quantity::decimal / ppc.total_units) as pallets_needed,
--   CASE 
--     WHEN ppc.is_default THEN 'Default'
--     ELSE 'Custom Selected'
--   END as config_type
-- FROM delivery_trip_items dti
-- JOIN products p ON p.id = dti.product_id
-- LEFT JOIN product_pallet_configs ppc ON ppc.id = dti.selected_pallet_config_id
-- WHERE dti.delivery_trip_store_id = 'xxx';
