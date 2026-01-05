-- ========================================
-- Add Reporter Avatar URL back to tickets_with_relations View
-- เพิ่ม reporter avatar_url กลับเข้าไปใน view tickets_with_relations
-- ========================================
-- 
-- Issue: The previous migration (20260115000000_fix_security_definer_views_and_rls.sql)
-- removed reporter_avatar_url from the view. This migration adds it back.
-- ========================================

-- DROP view ก่อนเพื่อหลีกเลี่ยงปัญหา column name conflict
DROP VIEW IF EXISTS public.tickets_with_relations CASCADE;

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

-- Explicitly set security_invoker (not security_definer)
ALTER VIEW public.tickets_with_relations SET (security_invoker = true);

-- Grant access to authenticated users
GRANT SELECT ON public.tickets_with_relations TO authenticated;

