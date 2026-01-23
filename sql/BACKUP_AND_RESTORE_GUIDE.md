# 🔒 คู่มือ Backup และ Restore ฐานข้อมูล

## ⚠️ สำคัญ: ต้อง Backup ก่อนแก้ไข RLS Policies!

---

## 📋 ขั้นตอนที่ 1: Backup ฐานข้อมูล

### วิธีที่ 1: ใช้ Supabase Dashboard (แนะนำ - ง่ายที่สุด)

1. ไปที่ **Supabase Dashboard** → **Project Settings** → **Database**
2. เลื่อนลงไปหา **Backups**
3. คลิก **Create Backup** หรือ **Download Backup**
4. รอให้ backup เสร็จ (อาจใช้เวลาสักครู่)
5. Download backup file (.sql หรือ .tar.gz)

### วิธีที่ 2: ใช้ Supabase CLI

```bash
# Install Supabase CLI (ถ้ายังไม่มี)
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Create backup
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql
```

### วิธีที่ 3: ใช้ pg_dump (ถ้ามี direct database access)

```bash
pg_dump -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -f backup_$(date +%Y%m%d_%H%M%S).dump
```

---

## 📋 ขั้นตอนที่ 2: ทดสอบใน Staging/Dev Environment ก่อน

**แนะนำ:** ทดสอบใน development/staging environment ก่อน production!

1. สร้าง staging database (ถ้ายังไม่มี)
2. Restore backup ไปที่ staging
3. รัน SQL scripts ใน staging
4. ทดสอบว่า application ยังทำงานได้
5. ถ้าทุกอย่าง OK แล้วค่อยรันใน production

---

## 📋 ขั้นตอนที่ 3: Restore ถ้าพัง

### วิธีที่ 1: ใช้ Supabase Dashboard

1. ไปที่ **Supabase Dashboard** → **Project Settings** → **Database**
2. คลิก **Restore from backup**
3. เลือก backup ที่ต้องการ
4. รอให้ restore เสร็จ

### วิธีที่ 2: ใช้ Supabase CLI

```bash
# Restore from backup file
supabase db reset --db-url postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
# หรือ
psql -h db.your-project.supabase.co -U postgres -d postgres < backup_file.sql
```

### วิธีที่ 3: ใช้ pg_restore

```bash
pg_restore -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  -c \
  backup_file.dump
```

---

## 🛡️ วิธีป้องกันปัญหา

### 1. ใช้ Transaction (Rollback ถ้า Error)

```sql
BEGIN;

-- รัน SQL commands ที่นี่
-- ถ้ามี error จะ rollback อัตโนมัติ

COMMIT; -- ถ้าทุกอย่าง OK
-- หรือ
ROLLBACK; -- ถ้ามีปัญหา
```

### 2. ตรวจสอบก่อนแก้ไข

```sql
-- ดู policies ที่มีอยู่ก่อน
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'vehicles';

-- ดู table structure
\d vehicles
```

### 3. แก้ไขทีละน้อย

- แก้ทีละ table
- ทดสอบหลังแก้แต่ละ table
- ถ้ามีปัญหาให้ rollback ทันที

---

## 🚨 ถ้าพังแล้วทำอย่างไร

### สถานการณ์ที่ 1: Application ไม่ทำงาน

1. **หยุดแก้ไขทันที**
2. **Restore จาก backup**
3. **ตรวจสอบ logs** ว่าเกิดอะไรขึ้น
4. **แก้ไข script** แล้วลองใหม่

### สถานการณ์ที่ 2: Policies ผิดพลาด

```sql
-- ดู policies ที่มีปัญหา
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'your_table';

-- ลบ policy ที่มีปัญหา
DROP POLICY IF EXISTS "problematic_policy" ON public.your_table;

-- สร้างใหม่
CREATE POLICY "fixed_policy" ...
```

### สถานการณ์ที่ 3: ฐานข้อมูลไม่สามารถเชื่อมต่อได้

1. **Restore จาก backup ทันที**
2. **ติดต่อ Supabase Support** (ถ้าจำเป็น)
3. **ตรวจสอบ connection settings**

---

## ✅ Checklist ก่อนแก้ไข

- [ ] ✅ Backup ฐานข้อมูลแล้ว
- [ ] ✅ ทดสอบใน staging/dev environment แล้ว
- [ ] ✅ อ่าน SQL scripts ทั้งหมดแล้ว
- [ ] ✅ เข้าใจว่าสคริปต์จะทำอะไร
- [ ] ✅ มี backup หลายจุด (local + cloud)
- [ ] ✅ รู้วิธี restore
- [ ] ✅ มีเวลาพอที่จะแก้ไขถ้ามีปัญหา

---

## 📞 ติดต่อ Support

ถ้ามีปัญหาหลังจาก restore:
- **Supabase Support**: https://supabase.com/support
- **Discord Community**: https://discord.supabase.com

---

## 💡 Tips

1. **Backup ก่อนทุกครั้ง** ที่จะแก้ไข database
2. **ทดสอบใน staging ก่อน** production เสมอ
3. **แก้ไขทีละน้อย** อย่าแก้ทั้งหมดพร้อมกัน
4. **บันทึกทุกการเปลี่ยนแปลง** (ใช้ migration scripts)
5. **มี rollback plan** เสมอ
