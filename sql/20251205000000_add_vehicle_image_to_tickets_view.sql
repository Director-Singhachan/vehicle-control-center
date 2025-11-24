-- ========================================
-- Add Vehicle Image URL to tickets_with_relations View
-- เพิ่ม vehicle image_url ใน view tickets_with_relations
-- ========================================

-- DROP view ก่อนเพื่อหลีกเลี่ยงปัญหา column name conflict
DROP VIEW IF EXISTS public.tickets_with_relations;

-- สร้าง view ใหม่พร้อม vehicle image_url
CREATE VIEW public.tickets_with_relations AS
SELECT 
  t.*,
  v.plate as vehicle_plate,
  v.make,
  v.model,
  v.type as vehicle_type,
  v.branch,
  v.image_url as vehicle_image_url,
  r.email as reporter_email,
  r.full_name as reporter_name,
  r.role as reporter_role
FROM public.tickets t
LEFT JOIN public.vehicles v ON t.vehicle_id = v.id
LEFT JOIN public.profiles r ON t.reporter_id = r.id;

