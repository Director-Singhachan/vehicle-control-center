-- Migration: Add payment_status to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_orders_payment_status;
ALTER TABLE public.orders ADD CONSTRAINT check_orders_payment_status
  CHECK (payment_status IS NULL OR payment_status IN (
    'ชำระแล้ว',
    'รอชำระ',
    'นัดชำระหนี้คงค้างเรียบร้อยแล้ว',
    'รอชำระหนี้คงค้าง'
  ));

COMMENT ON COLUMN public.orders.payment_status IS 'สถานะการชำระเงิน (null = ค่าว่าง/สั่งได้ปกติ)';
