-- ============================================================
-- Migration: Fix RLS for trip_packing_layout & trip_packing_layout_items
-- Purpose:   ปิดช่องให้ authenticated user ทุกคนลบ/แก้ข้อมูลกันได้
--            เดิม: USING(true) / WITH CHECK(true) ทุก operation
--            ใหม่:
--              SELECT  → ทุกคนที่ล็อกอิน (เพื่อไม่พัง analytics / ML functions)
--              INSERT/UPDATE → admin, manager, inspector, driver
--              DELETE  → admin, manager เท่านั้น
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. trip_packing_layout
-- ─────────────────────────────────────────────────────────────────────────────

-- ลบ policy เดิมที่อันตราย (คงไว้แต่ tpl_select ซึ่ง USING(true) อ่านอย่างเดียวไม่มีปัญหา)
DROP POLICY IF EXISTS tpl_insert ON public.trip_packing_layout;
DROP POLICY IF EXISTS tpl_update ON public.trip_packing_layout;
DROP POLICY IF EXISTS tpl_delete ON public.trip_packing_layout;

-- SELECT: ทุกคนที่ล็อกอินอ่านได้ (ไม่เปลี่ยน)
-- tpl_select ยังคงอยู่: FOR SELECT TO authenticated USING (true)

-- INSERT: เฉพาะ role ที่บันทึก layout ทริปในทางปฏิบัติ
CREATE POLICY tpl_insert ON public.trip_packing_layout
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'inspector', 'driver')
    )
  );

-- UPDATE: role เดียวกับ INSERT
CREATE POLICY tpl_update ON public.trip_packing_layout
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'inspector', 'driver')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'inspector', 'driver')
    )
  );

-- DELETE: เข้มงวดกว่า — admin และ manager เท่านั้น
CREATE POLICY tpl_delete ON public.trip_packing_layout
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. trip_packing_layout_items
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tpli_insert ON public.trip_packing_layout_items;
DROP POLICY IF EXISTS tpli_update ON public.trip_packing_layout_items;
DROP POLICY IF EXISTS tpli_delete ON public.trip_packing_layout_items;

-- SELECT: tpli_select ยังคงอยู่ (USING true) ไม่ต้องเปลี่ยน

-- INSERT: ต้องตรวจทั้งสิทธิ์ user และ trip_packing_layout ที่อ้างอิง
--         (layout นั้นต้องเชื่อมกับทริปจริงในระบบ — ป้องกัน orphan insert)
CREATE POLICY tpli_insert ON public.trip_packing_layout_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'inspector', 'driver')
    )
    AND
    EXISTS (
      SELECT 1 FROM public.trip_packing_layout tpl
      WHERE tpl.id = trip_packing_layout_id
    )
  );

-- UPDATE: role เดียวกับ INSERT
CREATE POLICY tpli_update ON public.trip_packing_layout_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'inspector', 'driver')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'inspector', 'driver')
    )
  );

-- DELETE: admin และ manager เท่านั้น
CREATE POLICY tpli_delete ON public.trip_packing_layout_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );
