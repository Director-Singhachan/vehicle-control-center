# 🧪 คู่มือการตั้งค่า Test/Staging Environment

## 📋 สรุป
สร้าง Supabase project ใหม่สำหรับ test/staging เพื่อทดสอบ migration ก่อนทำใน production

---

## 🎯 ขั้นตอนที่ 1: สร้าง Supabase Project ใหม่

### 1.1 ไปที่ Supabase Dashboard
1. เปิด: https://supabase.com/dashboard
2. คลิก **"New Project"** หรือ **"Create Project"**

### 1.2 ตั้งค่า Project
- **Organization:** เลือก organization ที่ต้องการ
- **Name:** `vehicle-control-center-staging` หรือ `vehicle-control-center-test`
- **Database Password:** สร้าง password ที่แข็งแรง (บันทึกไว้!)
- **Region:** เลือก region ที่ใกล้ที่สุด (เช่น `Southeast Asia (Singapore)`)
- **Pricing Plan:** เลือก **Free** หรือ **Pro** (ตามต้องการ)

### 1.3 รอให้ Project สร้างเสร็จ
- รอประมาณ 2-5 นาที
- รอจนเห็นหน้า Dashboard ของ project ใหม่

---

## 🔑 ขั้นตอนที่ 2: เก็บข้อมูล Connection

### 2.1 ไปที่ Project Settings
1. คลิก **Settings** (⚙️) ที่ sidebar ซ้าย
2. คลิก **API** ในเมนู Settings

### 2.2 เก็บข้อมูลสำคัญ
บันทึกข้อมูลต่อไปนี้:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Database Password: [password ที่สร้างไว้]
```

### 2.3 เก็บ Database Connection String
1. ไปที่ **Settings** → **Database**
2. คลิก **Connection string** → **URI**
3. คัดลอก connection string (มี password อยู่ด้วย)

---

## 📦 ขั้นตอนที่ 3: Copy Schema จาก Production

### 3.1 Export Schema จาก Production
1. ไปที่ Production project: https://supabase.com/dashboard/project/oqacrkcfpdhcntbldgrm
2. ไปที่ **SQL Editor**
3. รัน SQL นี้เพื่อ export schema:

```sql
-- Export all table structures
SELECT 
  'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || 
  string_agg(column_name || ' ' || data_type || 
    CASE 
      WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')'
      ELSE ''
    END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
    ', '
  ) || ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

### 3.2 หรือใช้ Supabase CLI (แนะนำ)
1. ติดตั้ง Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login:
   ```bash
   supabase login
   ```

3. Link project:
   ```bash
   supabase link --project-ref oqacrkcfpdhcntbldgrm
   ```

4. Export schema:
   ```bash
   supabase db dump -f schema.sql
   ```

---

## 🗄️ ขั้นตอนที่ 4: Import Schema ไปยัง Staging

### 4.1 วิธีที่ 1: ใช้ SQL Editor (ง่าย)
1. ไปที่ Staging project → **SQL Editor**
2. เปิดไฟล์ `sql/20251105120000_initial_schema.sql` (หรือ schema file ที่ export มา)
3. คัดลอกและวางใน SQL Editor
4. คลิก **Run**

### 4.2 วิธีที่ 2: ใช้ Supabase CLI (แนะนำ)
1. Link staging project:
   ```bash
   supabase link --project-ref [staging-project-ref]
   ```

2. Push schema:
   ```bash
   supabase db push
   ```

---

## 🔄 ขั้นตอนที่ 5: Copy Data (Optional)

### 5.1 Export Data จาก Production
```sql
-- Export orders (ตัวอย่าง)
COPY (SELECT * FROM public.orders LIMIT 100) TO STDOUT WITH CSV HEADER;
```

### 5.2 Import Data ไปยัง Staging
```sql
-- Import orders (ตัวอย่าง)
COPY public.orders FROM STDIN WITH CSV HEADER;
```

### 5.3 หรือใช้ Supabase CLI
```bash
# Export from production
supabase db dump --data-only -f data.sql

# Import to staging
supabase db push --data-only
```

---

## 🧪 ขั้นตอนที่ 6: ทดสอบ Migration

### 6.1 รัน Migration Scripts
1. ไปที่ Staging project → **SQL Editor**
2. รัน migration scripts ตามลำดับ:
   - `sql/20260125000000_fix_profiles_rls_performance.sql`
   - `sql/20260124_fix_order_number_generation_logic.sql`
   - `sql/แก้ไข_ด่วน_ไม่มี_ERROR.sql`

### 6.2 ตรวจสอบผลลัพธ์
- ตรวจสอบว่าไม่มี error
- ตรวจสอบว่า policies ถูกสร้าง/แก้ไขแล้ว
- ตรวจสอบว่า functions ทำงานได้

### 6.3 ทดสอบ Application
1. เปลี่ยน `.env` ให้ชี้ไปที่ staging:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://[staging-project].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[staging-anon-key]
   ```

2. รัน application:
   ```bash
   npm run dev
   ```

3. ทดสอบฟีเจอร์ต่างๆ:
   - Login/Logout
   - สร้างทริป
   - จัดออเดอร์ให้ทริป
   - ตรวจสอบ order_number generation

---

## ✅ ขั้นตอนที่ 7: ตรวจสอบและยืนยัน

### 7.1 ตรวจสอบ Performance
1. ไปที่ **Database** → **Performance**
2. ตรวจสอบว่า RLS policies ไม่มี warning
3. ตรวจสอบว่า queries ทำงานเร็วขึ้น

### 7.2 ตรวจสอบ Data Integrity
1. ตรวจสอบว่า order_number ไม่ซ้ำ
2. ตรวจสอบว่า orders ถูก assign ไปยัง trips ถูกต้อง
3. ตรวจสอบว่า RLS policies ทำงานถูกต้อง

### 7.3 สร้าง Test Report
บันทึกผลการทดสอบ:
- ✅ Migration scripts รันสำเร็จ
- ✅ ไม่มี error
- ✅ Performance ดีขึ้น
- ✅ Application ทำงานได้ปกติ

---

## 🚀 ขั้นตอนที่ 8: Deploy ไปยัง Production

### 8.1 เมื่อทดสอบเสร็จแล้ว
1. ตรวจสอบว่า staging ทำงานได้ดี
2. แจ้งทีมก่อน deploy
3. Backup production database

### 8.2 Deploy Migration
1. ไปที่ Production project → **SQL Editor**
2. รัน migration scripts เดียวกับที่รันใน staging
3. ตรวจสอบผลลัพธ์

### 8.3 Monitor Production
1. ตรวจสอบ error logs
2. ตรวจสอบ performance
3. ตรวจสอบ user feedback

---

## 📝 Checklist

### Setup Staging
- [ ] สร้าง Supabase project ใหม่
- [ ] เก็บ connection strings
- [ ] Export schema จาก production
- [ ] Import schema ไปยัง staging
- [ ] Copy test data (optional)

### Test Migration
- [ ] รัน migration scripts
- [ ] ตรวจสอบไม่มี error
- [ ] ทดสอบ application
- [ ] ตรวจสอบ performance
- [ ] ตรวจสอบ data integrity

### Deploy to Production
- [ ] Backup production database
- [ ] แจ้งทีม
- [ ] รัน migration scripts
- [ ] ตรวจสอบผลลัพธ์
- [ ] Monitor production

---

## 🔗 Links ที่มีประโยชน์

- Supabase Dashboard: https://supabase.com/dashboard
- Supabase CLI Docs: https://supabase.com/docs/guides/cli
- Supabase Migration Guide: https://supabase.com/docs/guides/database/migrations

---

## ⚠️ หมายเหตุสำคัญ

1. **อย่าลืม Backup:** Backup production database ก่อน deploy
2. **Test Thoroughly:** ทดสอบให้ละเอียดใน staging ก่อน
3. **Monitor:** ตรวจสอบ production หลัง deploy
4. **Rollback Plan:** เตรียม rollback plan ไว้ด้วย

---

## 🆘 ถ้ามีปัญหา

1. ตรวจสอบ error logs ใน Supabase Dashboard
2. ตรวจสอบ SQL Editor → History
3. ตรวจสอบ Database → Logs
4. ติดต่อ Supabase Support ถ้าจำเป็น
