-- Add repair tracking fields to tickets table
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS repair_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS repair_expected_completion TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS repair_assigned_to UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS repair_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.tickets.repair_start_date IS 'วันที่เริ่มดำเนินการซ่อม';
COMMENT ON COLUMN public.tickets.repair_expected_completion IS 'วันที่คาดว่าจะซ่อมเสร็จ';
COMMENT ON COLUMN public.tickets.repair_assigned_to IS 'ผู้รับผิดชอบนำรถเข้าซ่อม';
COMMENT ON COLUMN public.tickets.repair_notes IS 'หมายเหตุเพิ่มเติมเกี่ยวกับการซ่อม';
