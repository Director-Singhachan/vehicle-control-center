-- ========================================
-- ลบ constraint ที่บังคับให้ต้องมี pallet_id เมื่อ uses_pallet = true
-- เพื่อให้ user สามารถเลือก uses_pallet = true ได้ก่อนที่จะตั้งค่า pallet config
-- ========================================

-- ลบ constraint เดิมที่เคร่งครัดเกินไป
ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS check_pallet_required_if_uses_pallet;

-- Comment: ตอนนี้ uses_pallet และ pallet_id เป็นอิสระจากกัน
-- - uses_pallet = true หมายความว่า "สินค้านี้ควรใช้พาเลท" (user intent)
-- - pallet_id = UUID หมายความว่า "สินค้านี้มี default pallet ที่ระบุไว้" (optional reference)
-- - product_pallet_configs = มีการตั้งค่าการจัดเรียงบนพาเลท (actual configuration)
-- 
-- Logic ใหม่:
-- 1. ถ้ามี product_pallet_configs → ใช้สำหรับคำนวณ (ไม่สนใจ uses_pallet)
-- 2. ถ้าไม่มี config แต่ uses_pallet=true → แสดง warning ให้ user ตั้งค่า
-- 3. ถ้าไม่มี config และ uses_pallet=false → ไม่คำนวณพาเลท

COMMENT ON COLUMN public.products.uses_pallet IS 
'ระบุว่าสินค้านี้ใช้พาเลทหรือไม่ (user intent) - ไม่บังคับให้มี pallet_id';

COMMENT ON COLUMN public.products.pallet_id IS 
'พาเลท default ที่ใช้ (optional reference) - ไม่บังคับแม้ uses_pallet=true';
