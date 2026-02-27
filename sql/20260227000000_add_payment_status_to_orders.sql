-- Migration: Add payment_status to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN (
  'ชำระแล้ว',
  'รอชำระ',
  'นัดชำระหนี้คงค้างเรียบร้อยแล้ว',
  'รอชำระหนี้คงค้าง'
));

COMMENT ON COLUMN public.orders.payment_status IS 'สถานะการชำระเงิน (null = ค่าว่าง/สั่งได้ปกติ)';
