# Troubleshooting Guide

## 🔧 ปัญหาที่พบบ่อยและวิธีแก้ไข

### 1. Error: relation "public.garages" does not exist

**ปัญหา:**
```
ERROR: 42P01: relation "public.garages" does not exist
```

**สาเหตุ:**
- ไฟล์ `20251115132000_add_vehicle_management_tables.sql` มีการอ้างอิงถึง `public.garages` table ที่ยังไม่ได้สร้าง
- ใน `maintenance_history` table มี `garage_id uuid references public.garages(id)`

**วิธีแก้ไข:**

**Option 1: รัน migration ใหม่ (แนะนำ)**
- ไฟล์ `20251115132000_add_vehicle_management_tables.sql` ถูกแก้ไขแล้วให้ใช้ `garage text` แทน
- ลบ `maintenance_history` table (ถ้ามี):
  ```sql
  DROP TABLE IF EXISTS public.maintenance_history CASCADE;
  ```
- รัน migration ใหม่:
  ```sql
  -- รันไฟล์: sql/20251115132000_add_vehicle_management_tables.sql
  ```

**Option 2: แก้ไข table ที่มีอยู่แล้ว**
- รัน migration fix:
  ```sql
  -- รันไฟล์: sql/20251202030000_fix_garage_reference.sql
  ```
- Migration นี้จะ:
  - ลบ foreign key constraint (ถ้ามี)
  - เปลี่ยน `garage_id` เป็น `garage text`

---

### 2. Error: extension "uuid-ossp" does not exist

**ปัญหา:**
```
ERROR: extension "uuid-ossp" does not exist
```

**วิธีแก้ไข:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

### 3. Error: type "app_role" already exists

**ปัญหา:**
```
ERROR: type "app_role" already exists
```

**วิธีแก้ไข:**
- ไม่เป็นไร SQL ใช้ `IF NOT EXISTS` แล้ว
- ถ้ายัง error ให้ลบ type เก่าก่อน:
  ```sql
  DROP TYPE IF EXISTS app_role CASCADE;
  ```
- แล้วรัน migration ใหม่

---

### 4. Error: duplicate key value violates unique constraint

**ปัญหา:**
```
ERROR: duplicate key value violates unique constraint
```

**สาเหตุ:**
- รัน migration ซ้ำ
- มีข้อมูลซ้ำ

**วิธีแก้ไข:**
- ตรวจสอบว่ามีข้อมูลซ้ำหรือไม่
- ใช้ `IF NOT EXISTS` ใน migrations (มีอยู่แล้ว)
- ถ้ายัง error ให้ลบข้อมูลซ้ำก่อน

---

### 5. Error: permission denied for schema public

**ปัญหา:**
```
ERROR: permission denied for schema public
```

**วิธีแก้ไข:**
- ตรวจสอบว่าใช้ service_role key หรือไม่
- ใน Supabase ให้รัน SQL ใน SQL Editor (มีสิทธิ์เต็ม)
- ตรวจสอบ RLS policies

---

### 6. View ไม่แสดงข้อมูล

**ปัญหา:**
- Query view แล้วได้ข้อมูลว่าง

**วิธีแก้ไข:**
- ตรวจสอบว่า:
  1. มีข้อมูลในตารางที่ view อ้างอิงหรือไม่
  2. RLS policies อนุญาตให้อ่านหรือไม่
  3. WHERE conditions ถูกต้องหรือไม่

**ตัวอย่าง:**
```sql
-- ตรวจสอบข้อมูลในตาราง
SELECT COUNT(*) FROM vehicles;
SELECT COUNT(*) FROM vehicle_usage;

-- ตรวจสอบ view
SELECT * FROM vehicle_dashboard LIMIT 5;
```

---

### 7. Function ไม่ทำงาน

**ปัญหา:**
- Trigger function ไม่ทำงาน
- Function return error

**วิธีแก้ไข:**
- ตรวจสอบว่า trigger ถูกสร้างหรือไม่:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname LIKE '%fuel_efficiency%';
  ```
- ตรวจสอบ function:
  ```sql
  SELECT * FROM pg_proc WHERE proname = 'calculate_fuel_efficiency';
  ```
- ทดสอบ function:
  ```sql
  SELECT public.calculate_fuel_efficiency();
  ```

---

### 8. RLS Policy Blocking Access

**ปัญหา:**
- Query แล้วได้ empty result
- Error: new row violates row-level security policy

**วิธีแก้ไข:**
- ตรวจสอบ policies:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'vehicles';
  ```
- ตรวจสอบ role ของ user:
  ```sql
  SELECT * FROM profiles WHERE id = auth.uid();
  ```
- ทดสอบด้วย service_role key (bypass RLS)

---

## 🔍 วิธีตรวจสอบ Migration Status

### ตรวจสอบ Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### ตรวจสอบ Views
```sql
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public';
```

### ตรวจสอบ Functions
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

### ตรวจสอบ Indexes
```sql
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

## 📝 Checklist เมื่อเกิด Error

- [ ] ตรวจสอบ error message ให้ละเอียด
- [ ] ตรวจสอบว่า migration รันตามลำดับหรือไม่
- [ ] ตรวจสอบว่า dependencies (tables, types) มีอยู่แล้วหรือไม่
- [ ] ตรวจสอบ permissions
- [ ] ตรวจสอบ RLS policies
- [ ] ดู logs ใน Supabase Dashboard
- [ ] ทดสอบด้วย SQL queries แยก

---

## 🆘 ยังแก้ไม่ได้?

1. **ตรวจสอบ Documentation:**
   - `docs/SQL_MIGRATION_GUIDE.md`
   - `docs/COMPATIBILITY_REPORT.md`

2. **ตรวจสอบ SQL Files:**
   - ดู comments ในไฟล์ SQL
   - ตรวจสอบ syntax

3. **ทดสอบทีละส่วน:**
   - รัน SQL queries แยก
   - ตรวจสอบแต่ละ table/view/function

4. **Reset Database (ถ้าจำเป็น):**
   - Backup ข้อมูลก่อน
   - ลบ tables/views/functions เก่า
   - รัน migrations ใหม่ตามลำดับ

---

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)

