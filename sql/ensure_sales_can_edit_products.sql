-- ========================================
-- Ensure Sales Role Can Edit Products
-- ตรวจสอบและให้สิทธิ์ Sales ในการแก้ไขราคาสินค้า
-- ========================================

BEGIN;

-- 1. อัพเดท Policy สำหรับตาราง products (แก้ไขสินค้า)
-- ให้ sales สามารถ INSERT และ UPDATE ได้

-- ลบ Policy เดิมก่อน (เพื่อความชัวร์)
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;

-- สร้างใหม่โดยรวม sales
CREATE POLICY "products_insert"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'sales') -- เพิ่ม sales
  )
);

CREATE POLICY "products_update"
ON public.products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'sales') -- เพิ่ม sales
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'manager', 'sales') -- เพิ่ม sales
  )
);

-- 2. อัพเดท Policy สำหรับตาราง product_tier_prices (ราคาสินค้าตาม Tier)
-- ให้ sales สามารถจัดการราคาตาม Tier ได้

DROP POLICY IF EXISTS "Admin and sales can manage product tier prices" ON public.product_tier_prices;
-- ลบ Policy เก่าที่มีชื่ออื่นอาจจะหลงเหลือ
DROP POLICY IF EXISTS "Admin can manage product tier prices" ON public.product_tier_prices;

CREATE POLICY "Admin and sales can manage product tier prices" 
  ON public.product_tier_prices FOR ALL TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'sales'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'sales'))
  );

-- 3. แจ้งผลลัพธ์
DO $$
BEGIN
    RAISE NOTICE 'Updated RLS policies: Sales role can now edit products and tier prices.';
END $$;

COMMIT;
