-- ========================================
-- ระบบขยายระดับลูกค้าเป็น 9 ระดับ และระบบ Log การนำเข้า
-- Expand Customer Tiers to 9 Levels and Add Import Logging
-- ========================================

-- 1. เพิ่ม/อัปเดตระดับให้ครบ 1-9
INSERT INTO public.customer_tiers (tier_code, tier_name, description, discount_percent, color, display_order) VALUES
('6', 'ระดับ 6', 'ระดับเพิ่มเติม', 0.00, '#6366F1', 6),
('7', 'ระดับ 7', 'ระดับเพิ่มเติม', 0.00, '#A855F7', 7),
('8', 'ระดับ 8', 'ระดับเพิ่มเติม', 0.00, '#EC4899', 8),
('9', 'ระดับ 9', 'ระดับเพิ่มเติม', 0.00, '#64748B', 9)
ON CONFLICT (tier_code) DO UPDATE SET is_active = true;

-- 2. สร้างตาราง product_import_logs สำหรับบันทึกประวัติการนำเข้า
CREATE TABLE IF NOT EXISTS public.product_import_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_date DATE NOT NULL, -- วันที่ระบุในหัวเอกสาร Printed Date
  product_code VARCHAR(100) NOT NULL,
  product_name TEXT,
  unit TEXT,
  action_type VARCHAR(20) NOT NULL, -- 'created' หรือ 'updated'
  changes JSONB NOT NULL, -- เก็บรายละเอียด {field: {old: v, new: v}} หรือราคาทั้งหมดถ้าเป็น created
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Index สำหรับการค้นหา
CREATE INDEX IF NOT EXISTS idx_import_logs_product_code ON public.product_import_logs(product_code);
CREATE INDEX IF NOT EXISTS idx_import_logs_date ON public.product_import_logs(import_date);

-- Enable RLS
ALTER TABLE public.product_import_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view import logs" 
  ON public.product_import_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Manager can insert import logs" 
  ON public.product_import_logs FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager', 'sales'))
  );

-- Comments
COMMENT ON TABLE public.product_import_logs IS 'บันทึกประวัติการนำเข้าและแก้ไขข้อมูลจากไฟล์ Excel';
