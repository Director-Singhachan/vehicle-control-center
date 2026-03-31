-- หน่วยขายต่อบรรทัด (เช่น ขวด จาก SML) — แยกจาก products.unit ที่มักเป็นหน่วยมาตรฐาน (ลัง)
ALTER TABLE public.delivery_trip_items
  ADD COLUMN IF NOT EXISTS unit text;

COMMENT ON COLUMN public.delivery_trip_items.unit IS 'หน่วยจากบรรทัดออเดอร์ (order_items.unit); ถ้า null ให้ UI fallback ไป products.unit';
