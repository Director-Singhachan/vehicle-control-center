-- หน้าทดสอบ RLS ถูกถอดออกจากแอป — ลบแถว matrix ที่ไม่ใช้แล้ว
DELETE FROM public.role_feature_access WHERE feature_key = 'tab.rls_test';
