# แก้ไขปัญหา RLS Infinite Recursion

## ❌ ปัญหาที่พบ

```
Error: infinite recursion detected in policy for relation "profiles"
```

## 🔍 สาเหตุ

RLS policy ของ `profiles` table มีการ query `profiles` table ภายใน policy เอง:

```sql
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
```

เมื่อ Supabase ตรวจสอบ policy นี้ มันต้อง query `profiles` table ซึ่งจะเรียก policy อีกครั้ง → เกิด infinite recursion

## ✅ วิธีแก้ไข

### ใช้ Helper Functions

สร้าง functions ที่เป็น `SECURITY DEFINER` เพื่อ bypass RLS:

```sql
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role = 'admin'
  );
$$;
```

แล้วใช้ function ใน policy:

```sql
create policy "profiles self read" on public.profiles
  for select using (
    id = auth.uid() 
    or public.is_admin(auth.uid())
  );
```

## 🚀 วิธีแก้ไข

### ขั้นตอนที่ 1: รัน Migration Fix

1. ไปที่ Supabase Dashboard → **SQL Editor**
2. รันไฟล์: `sql/20251203000000_fix_profiles_rls_infinite_recursion.sql`
3. ตรวจสอบว่าไม่มี error

### ขั้นตอนที่ 2: ตรวจสอบ

หลังจากรัน migration แล้ว:

1. **ตรวจสอบ functions:**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
     AND routine_name IN ('is_admin', 'is_manager_or_admin');
   ```

2. **ตรวจสอบ policies:**
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename = 'profiles';
   ```

3. **ทดสอบ query:**
   ```sql
   SELECT * FROM profiles LIMIT 1;
   ```
   - ควรไม่มี error "infinite recursion"

### ขั้นตอนที่ 3: Refresh Frontend

1. Refresh browser
2. ตรวจสอบว่า error หายไป
3. Dashboard ควรโหลดข้อมูลได้

## 📝 หมายเหตุ

- Functions ใช้ `SECURITY DEFINER` เพื่อ bypass RLS
- ใช้ `SET search_path` เพื่อความปลอดภัย
- Functions เป็น `STABLE` เพื่อ performance

## 🔍 Troubleshooting

### ถ้ายังมี error

1. **ตรวจสอบว่า migration รันสำเร็จ:**
   ```sql
   SELECT * FROM pg_proc WHERE proname IN ('is_admin', 'is_manager_or_admin');
   ```

2. **ตรวจสอบ policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

3. **ทดสอบ function:**
   ```sql
   SELECT public.is_admin(auth.uid());
   ```

### ถ้า function ไม่ทำงาน

- ตรวจสอบว่า user มี profile ใน database
- ตรวจสอบว่า RLS เปิดอยู่
- ตรวจสอบว่า function มี `SECURITY DEFINER`

## 📚 Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)

