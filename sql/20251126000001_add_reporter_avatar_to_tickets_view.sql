-- ========================================
-- Add Reporter Avatar URL to tickets_with_relations View
-- เพิ่ม reporter avatar_url ใน view tickets_with_relations
-- ========================================

-- DROP view ก่อนเพื่อหลีกเลี่ยงปัญหา column name conflict
DROP VIEW IF EXISTS public.tickets_with_relations;

-- สร้าง view ใหม่พร้อม reporter avatar_url
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
  r.role as reporter_role,
  r.avatar_url as reporter_avatar_url
FROM public.tickets t
LEFT JOIN public.vehicles v ON t.vehicle_id = v.id
LEFT JOIN public.profiles r ON t.reporter_id = r.id;
