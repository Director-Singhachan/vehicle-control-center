-- Quick fix: Add branch column to orders table
-- Date: 2026-01-27
-- Purpose: เพิ่ม branch column ให้ orders table (ถ้ายังไม่มี)

-- Add branch column to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS branch TEXT;

-- Create index
CREATE INDEX IF NOT EXISTS idx_orders_branch
  ON public.orders(branch);

-- Add comment
COMMENT ON COLUMN public.orders.branch IS 'สาขาของออเดอร์ (HQ = สำนักงานใหญ่, SD = สาขาสอยดาว)';

-- Verify the column was created
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'orders' 
  AND column_name = 'branch';
