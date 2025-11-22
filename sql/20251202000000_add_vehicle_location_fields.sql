-- ========================================
-- Add Location Fields to Vehicles Table
-- เพิ่ม fields สำหรับเก็บตำแหน่งรถ (lat/lng)
-- ========================================

-- เพิ่ม columns สำหรับ location (optional - ถ้าต้องการใช้ map)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS lat numeric(10, 8),
  ADD COLUMN IF NOT EXISTS lng numeric(11, 8);

-- เพิ่ม comment
COMMENT ON COLUMN public.vehicles.lat IS 'Latitude coordinate for vehicle location';
COMMENT ON COLUMN public.vehicles.lng IS 'Longitude coordinate for vehicle location';

-- หมายเหตุ:
-- - lat/lng เป็น optional fields (NULL ได้)
-- - ถ้ายังไม่มีข้อมูล location สามารถใช้ NULL ได้
-- - Frontend ควร handle กรณีที่ lat/lng เป็น NULL

