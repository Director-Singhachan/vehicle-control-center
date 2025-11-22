# 🧪 คู่มือการทดสอบ RLS (Row Level Security)

**อัปเดตล่าสุด:** 3 ธันวาคม 2025

---

## 📋 สารบัญ

1. [ภาพรวม](#ภาพรวม)
2. [การสร้าง Test Users](#การสร้าง-test-users)
3. [การทดสอบ Permissions](#การทดสอบ-permissions)
4. [Test Cases](#test-cases)
5. [Troubleshooting](#troubleshooting)

---

## 🎯 ภาพรวม

RLS (Row Level Security) เป็นระบบความปลอดภัยของ PostgreSQL ที่ควบคุมการเข้าถึงข้อมูลในระดับแถว (row level) ตาม policies ที่กำหนดไว้

### Roles ในระบบ

| Role | คำอธิบาย | Permissions |
|------|----------|-------------|
| `user` | ผู้ใช้ทั่วไป | อ่านข้อมูลพื้นฐาน, สร้าง ticket |
| `inspector` | ผู้ตรวจสอบ | ทุกอย่างของ user + อนุมัติ ticket ระดับ inspector |
| `manager` | ผู้จัดการ | ทุกอย่างของ inspector + จัดการ vehicles, costs, อนุมัติ ticket ระดับ manager |
| `executive` | ผู้บริหาร | อ่านข้อมูลทั้งหมด, อนุมัติ ticket ระดับ executive |
| `admin` | ผู้ดูแลระบบ | เข้าถึงและจัดการข้อมูลทั้งหมด |

---

## 👥 การสร้าง Test Users

### วิธีที่ 1: ผ่าน Supabase Dashboard (แนะนำ)

1. เปิด Supabase Dashboard → **Authentication** → **Users**
2. คลิก **Add User** → **Create new user**
3. สร้าง users ตามรายการด้านล่าง:

#### Test Users ที่ต้องสร้าง:

| Email | Password | Full Name | Role |
|-------|----------|-----------|------|
| `admin@test.vehicle-control.local` | `Test1234!` | Admin User | admin |
| `manager@test.vehicle-control.local` | `Test1234!` | Manager User | manager |
| `inspector@test.vehicle-control.local` | `Test1234!` | Inspector User | inspector |
| `executive@test.vehicle-control.local` | `Test1234!` | Executive User | executive |
| `user@test.vehicle-control.local` | `Test1234!` | Regular User | user |

**⚠️ หมายเหตุ:** 
- ตั้งค่า **Auto Confirm User** = `true` เพื่อไม่ต้องยืนยันอีเมล
- ตั้งค่า **Email Confirmed** = `true`

### วิธีที่ 2: ผ่าน Supabase Auth API

```bash
# Admin User
curl -X POST 'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.vehicle-control.local",
    "password": "Test1234!",
    "email_confirm": true,
    "user_metadata": {
      "full_name": "Admin User"
    }
  }'

# ทำซ้ำสำหรับ users อื่นๆ (manager, inspector, executive, user)
```

### วิธีที่ 3: ผ่าน SQL (หลังจากสร้าง users แล้ว)

1. รัน migration: `sql/20251203010000_create_test_users.sql`
2. สร้าง profiles ด้วย function:

```sql
-- สร้าง profiles สำหรับ test users
SELECT public.create_test_user('admin@test.vehicle-control.local', 'Test1234!', 'Admin User', 'admin');
SELECT public.create_test_user('manager@test.vehicle-control.local', 'Test1234!', 'Manager User', 'manager');
SELECT public.create_test_user('inspector@test.vehicle-control.local', 'Test1234!', 'Inspector User', 'inspector');
SELECT public.create_test_user('executive@test.vehicle-control.local', 'Test1234!', 'Executive User', 'executive');
SELECT public.create_test_user('user@test.vehicle-control.local', 'Test1234!', 'Regular User', 'user');
```

### ตรวจสอบว่า Test Users ถูกสร้างแล้ว

```sql
-- ตรวจสอบ profiles
SELECT id, email, full_name, role, created_at
FROM public.profiles
WHERE email LIKE '%@test.vehicle-control.local'
ORDER BY role;

-- ตรวจสอบ auth users
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email LIKE '%@test.vehicle-control.local'
ORDER BY email;
```

---

## 🧪 การทดสอบ Permissions

### 1. ทดสอบผ่าน Frontend (แนะนำ)

1. เปิดแอปพลิเคชัน
2. Logout จากบัญชีปัจจุบัน (ถ้ามี)
3. Login ด้วย test user แต่ละ role
4. ทดสอบการเข้าถึงหน้าต่างๆ:
   - Dashboard (ควรเข้าถึงได้ทุก role)
   - Vehicles (ควรเข้าถึงได้ทุก role)
   - Tickets (ควรเข้าถึงได้ทุก role)
   - Profile (ควรเข้าถึงได้ทุก role)
   - Settings (ควรเข้าถึงได้เฉพาะ admin/manager)

### 2. ทดสอบผ่าน Supabase SQL Editor

#### ทดสอบ Profiles RLS

```sql
-- Login เป็น admin
-- ควรเห็น profiles ทั้งหมด
SELECT * FROM public.profiles;

-- Login เป็น user
-- ควรเห็นเฉพาะ profile ของตัวเอง
SELECT * FROM public.profiles;
```

#### ทดสอบ Vehicles RLS

```sql
-- ทุก role ควรอ่าน vehicles ได้
SELECT * FROM public.vehicles;

-- ทดสอบการสร้าง vehicle (ควรได้เฉพาะ manager/admin)
INSERT INTO public.vehicles (plate, make, model, type, branch)
VALUES ('ทดสอบ-9999', 'Test', 'Model', 'Type', 'Branch');
-- Expected: user/inspector/executive → Error, manager/admin → Success

-- ทดสอบการแก้ไข vehicle (ควรได้เฉพาะ manager/admin)
UPDATE public.vehicles SET make = 'Updated' WHERE plate = 'ทดสอบ-9999';
-- Expected: user/inspector/executive → Error, manager/admin → Success
```

#### ทดสอบ Tickets RLS

```sql
-- ทุก role ควรอ่าน tickets ได้
SELECT * FROM public.tickets;

-- ทดสอบการสร้าง ticket (ทุก role ควรทำได้)
INSERT INTO public.tickets (
  reporter_id,
  vehicle_id,
  odometer,
  urgency,
  repair_type,
  problem_description,
  status
)
VALUES (
  auth.uid(), -- Current user ID
  (SELECT id FROM public.vehicles LIMIT 1),
  50000,
  'medium',
  'Engine',
  'Test ticket',
  'pending'
);
-- Expected: ทุก role → Success

-- ทดสอบการแก้ไข ticket (ควรได้เฉพาะ reporter, manager, admin)
UPDATE public.tickets 
SET problem_description = 'Updated'
WHERE id = (SELECT id FROM public.tickets WHERE reporter_id = auth.uid() LIMIT 1);
-- Expected: reporter/manager/admin → Success, others → Error
```

#### ทดสอบ Ticket Costs RLS

```sql
-- ทุก role ควรอ่าน costs ได้
SELECT * FROM public.ticket_costs;

-- ทดสอบการสร้าง cost (ควรได้เฉพาะ manager/admin)
INSERT INTO public.ticket_costs (ticket_id, description, cost)
VALUES (
  (SELECT id FROM public.tickets LIMIT 1),
  'Test cost',
  1000
);
-- Expected: manager/admin → Success, others → Error
```

### 3. ทดสอบผ่าน API (Postman/curl)

```bash
# Login เป็น admin
curl -X POST 'https://YOUR_PROJECT.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.vehicle-control.local",
    "password": "Test1234!"
  }'

# ใช้ access_token ที่ได้ในการเรียก API
curl 'https://YOUR_PROJECT.supabase.co/rest/v1/profiles?select=*' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

---

## ✅ Test Cases

### Test Case 1: Profiles Access

| Role | Read Own Profile | Read Other Profiles | Update Own Profile | Update Other Profiles |
|------|------------------|---------------------|-------------------|----------------------|
| user | ✅ | ❌ | ✅ | ❌ |
| inspector | ✅ | ❌ | ✅ | ❌ |
| manager | ✅ | ❌ | ✅ | ❌ |
| executive | ✅ | ❌ | ✅ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ |

### Test Case 2: Vehicles Access

| Role | Read Vehicles | Create Vehicle | Update Vehicle | Delete Vehicle |
|------|--------------|----------------|----------------|----------------|
| user | ✅ | ❌ | ❌ | ❌ |
| inspector | ✅ | ❌ | ❌ | ❌ |
| manager | ✅ | ✅ | ✅ | ✅ |
| executive | ✅ | ❌ | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ |

### Test Case 3: Tickets Access

| Role | Read Tickets | Create Ticket | Update Own Ticket | Update Any Ticket | Approve Ticket |
|------|--------------|---------------|-------------------|-------------------|---------------|
| user | ✅ | ✅ | ✅ | ❌ | ❌ |
| inspector | ✅ | ✅ | ✅ | ❌ | ✅ (inspector level) |
| manager | ✅ | ✅ | ✅ | ✅ | ✅ (manager level) |
| executive | ✅ | ✅ | ✅ | ❌ | ✅ (executive level) |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ (all levels) |

### Test Case 4: Ticket Costs Access

| Role | Read Costs | Create Cost | Update Cost | Delete Cost |
|------|------------|-------------|-------------|-------------|
| user | ✅ | ❌ | ❌ | ❌ |
| inspector | ✅ | ❌ | ❌ | ❌ |
| manager | ✅ | ✅ | ✅ | ✅ |
| executive | ✅ | ❌ | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ |

---

## 🔧 Troubleshooting

### ปัญหา: "infinite recursion detected in policy"

**สาเหตุ:** RLS policy เรียกใช้ function ที่ต้องอ่าน profiles table อีกครั้ง

**วิธีแก้:**
1. รัน migration: `sql/20251203000000_fix_profiles_rls_infinite_recursion.sql`
2. ตรวจสอบว่า helper functions (`is_admin`, `is_manager_or_admin`) ถูกสร้างแล้ว:

```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('is_admin', 'is_manager_or_admin');
```

### ปัญหา: "permission denied for table profiles"

**สาเหตุ:** User ไม่มีสิทธิ์เข้าถึง profiles table

**วิธีแก้:**
1. ตรวจสอบว่า user มี profile ใน `public.profiles`:

```sql
SELECT * FROM public.profiles WHERE id = auth.uid();
```

2. ถ้าไม่มี profile ให้สร้าง:

```sql
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (auth.uid(), 'user@example.com', 'User Name', 'user');
```

### ปัญหา: "relation does not exist"

**สาเหตุ:** Table หรือ view ยังไม่ถูกสร้าง

**วิธีแก้:**
1. ตรวจสอบว่า migrations ทั้งหมดถูกรันแล้ว
2. ตรวจสอบว่า table มีอยู่จริง:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

### ปัญหา: Test user ไม่สามารถ login ได้

**สาเหตุ:** User ยังไม่ถูก confirm หรือ password ผิด

**วิธีแก้:**
1. ตรวจสอบใน Supabase Dashboard → Authentication → Users
2. ตรวจสอบว่า **Email Confirmed** = `true`
3. ตรวจสอบว่า **Auto Confirm User** = `true` (สำหรับ test users)

---

## 📚 เอกสารเพิ่มเติม

- [RLS_FIX.md](./RLS_FIX.md) - คู่มือแก้ไขปัญหา RLS infinite recursion
- [SQL_MIGRATION_GUIDE.md](./SQL_MIGRATION_GUIDE.md) - คู่มือการรัน migrations
- [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) - แผนการพัฒนาโปรเจกต์

---

## 🎯 Checklist การทดสอบ

- [ ] สร้าง test users ทั้ง 5 roles
- [ ] ทดสอบ Profiles RLS (read/update)
- [ ] ทดสอบ Vehicles RLS (read/create/update)
- [ ] ทดสอบ Tickets RLS (read/create/update/approve)
- [ ] ทดสอบ Ticket Costs RLS (read/create/update)
- [ ] ทดสอบ ProtectedRoute ใน frontend
- [ ] ทดสอบการแสดง/ซ่อน UI elements ตาม role
- [ ] ทดสอบ error handling เมื่อไม่มีสิทธิ์

---

**หมายเหตุ:** เอกสารนี้อาจมีการอัปเดตตามการเปลี่ยนแปลงของระบบ กรุณาตรวจสอบเวอร์ชันล่าสุดเสมอ

