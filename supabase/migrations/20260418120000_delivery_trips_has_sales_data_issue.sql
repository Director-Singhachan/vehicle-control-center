-- ทำเครื่องหมายทริปที่มีปัญหาข้อมูลการขาย/บิล (คีย์ผิด แก้บิลหลังส่ง ฯลฯ) — แยกจากปัญหาแพ็ค/โหลด
ALTER TABLE public.delivery_trips
  ADD COLUMN IF NOT EXISTS has_sales_data_issue boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.delivery_trips.has_sales_data_issue IS
  'ทริปนี้มีความผิดพลาดด้านข้อมูลการขายหรือบิล (เช่น คีย์ผิด แก้บิลหลังออกรถ) — ใช้แสดงคำเตือน ไม่แก้ประวัติการขนส่ง';
