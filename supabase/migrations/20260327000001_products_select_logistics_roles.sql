-- อนุญาตให้ warehouse / accounting / service_staff / hr อ่าน products ได้
-- เหตุผล: order_items ดึงแบบ select product:products(*) — ถ้าไม่มีสิทธิ์ SELECT บน products
-- จะไม่เห็นชื่อสินค้าและรหัสตอนจัดทริป / เลือกออเดอร์ (แม้ตั้ง tab.products ใน matrix แล้วก็ตาม)
-- นโยบาย insert/update ยังคงเดิม (เฉพาะ admin, manager, sales)

DROP POLICY IF EXISTS "products_select" ON public.products;

CREATE POLICY "products_select"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN (
      'admin',
      'manager',
      'inspector',
      'user',
      'driver',
      'executive',
      'sales',
      'warehouse',
      'accounting',
      'service_staff',
      'hr'
    )
  )
);

COMMENT ON POLICY "products_select" ON public.products IS
  'ดูรายการสินค้าได้สำหรับทุก role ภายในองค์กรที่ใช้งานออเดอร์/ทริป (รวม warehouse) — แก้ไข catalog ยังจำกัดตาม policies อื่น';
