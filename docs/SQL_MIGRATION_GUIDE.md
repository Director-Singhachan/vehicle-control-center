# SQL Migration Guide

## 📋 ลำดับการรัน SQL Migrations

รัน SQL files ตามลำดับนี้ใน Supabase SQL Editor:

### 1. Initial Schema
```sql
-- รันไฟล์: sql/20251105120000_initial_schema.sql
```
**สร้าง:**
- Profiles table
- Vehicles table
- Tickets table
- Ticket approvals table
- Ticket costs table
- RLS policies
- Auth trigger

### 2. Add Missing Fields
```sql
-- รันไฟล์: sql/20251106120000_add_missing_fields.sql
```
**เพิ่ม:**
- Garage field
- Inspector/Manager/Executive fields
- Ticket number
- Approval history
- Signature URLs
- Indexes

### 3. Add Audit Logs
```sql
-- รันไฟล์: sql/20251115130000_add_audit_logs.sql
```
**สร้าง:**
- Audit logs table
- Audit logging function
- Triggers for tickets และ approvals

### 4. Vehicle Management Tables
```sql
-- รันไฟล์: sql/20251115132000_add_vehicle_management_tables.sql
```
**สร้าง:**
- vehicle_usage table
- fuel_records table
- maintenance_schedules table
- maintenance_history table
- vehicle_alerts table
- Views: vehicle_dashboard, fuel_efficiency_summary, vehicle_usage_summary
- Functions: calculate_fuel_efficiency(), update_maintenance_schedule(), check_maintenance_alerts()

### 5. Add Ticket Costs Fields
```sql
-- รันไฟล์: sql/20251110_add_ticket_costs_category_note.sql
```
**เพิ่ม:**
- category column
- note column

### 6. Add Manual Correction Flag
```sql
-- รันไฟล์: sql/20251117140000_alter_vehicle_usage_add_manual_correction.sql
```
**เพิ่ม:**
- is_manual_correction column

### 7. Setup Cron Job (Optional)
```sql
-- รันไฟล์: sql/20251120000000_setup_pm_cron_job.sql
```
**หมายเหตุ:** 
- ต้องมี pg_cron extension
- หรือใช้ external cron service แทน

### 8. Compatibility Fixes (แนะนำให้รัน)
```sql
-- รันไฟล์: sql/20251202000000_add_vehicle_location_fields.sql
-- เพิ่ม lat/lng fields สำหรับ map (optional)
```

```sql
-- รันไฟล์: sql/20251202010000_create_daily_usage_view.sql
-- สร้าง view สำหรับแสดงการใช้งานรายวัน
```

```sql
-- รันไฟล์: sql/20251202020000_create_vehicle_status_function.sql
-- สร้าง function และ view สำหรับคำนวณสถานะรถ
```

```sql
-- รันไฟล์: sql/20251202030000_fix_garage_reference.sql
-- แก้ไข garage reference (ถ้ารัน migration เก่าแล้วเกิด error)
-- เปลี่ยน garage_id เป็น garage text ใน maintenance_history
```

```sql
-- รันไฟล์: sql/20251203000000_fix_profiles_rls_infinite_recursion.sql
-- ⚠️ แก้ไข RLS infinite recursion (สำคัญ!)
-- แก้ไขปัญหา infinite recursion ใน profiles RLS policy
-- สร้าง helper functions และอัปเดต policies
```

**หมายเหตุ:** 
- Migrations เหล่านี้แก้ไขปัญหาความเข้ากันได้ระหว่าง frontend และ database
- ดูรายละเอียดใน `docs/COMPATIBILITY_REPORT.md`
- **สำคัญ:** ถ้ารัน `20251115132000_add_vehicle_management_tables.sql` แล้วเกิด error เรื่อง "garages does not exist" ให้รัน `20251202030000_fix_garage_reference.sql` เพื่อแก้ไข
- **สำคัญ:** ถ้าเกิด error "infinite recursion detected in policy for relation profiles" ให้รัน `20251203000000_fix_profiles_rls_infinite_recursion.sql` ทันที (ดู `docs/RLS_FIX.md`)

---

## ✅ วิธีตรวจสอบว่า Migration สำเร็จ

### 1. ตรวจสอบ Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

ควรเห็น:
- audit_logs
- fuel_records
- maintenance_history
- maintenance_schedules
- profiles
- ticket_approvals
- ticket_costs
- tickets
- vehicle_alerts
- vehicle_usage
- vehicles

### 2. ตรวจสอบ Views
```sql
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public';
```

ควรเห็น:
- fuel_efficiency_summary
- tickets_with_relations
- vehicle_dashboard
- vehicle_usage_summary

### 3. ตรวจสอบ Functions
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

ควรเห็น:
- calculate_fuel_efficiency
- check_maintenance_alerts
- current_user_id
- handle_new_user
- log_audit
- update_maintenance_schedule
- update_ticket_approval_history

### 4. ตรวจสอบ RLS Policies
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

---

## 🔧 Troubleshooting

### Error: extension "uuid-ossp" does not exist
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Error: type "app_role" already exists
- ไม่เป็นไร SQL ใช้ `IF NOT EXISTS` แล้ว

### Error: relation "garages" does not exist
- ใน maintenance_history มี reference ถึง garages table
- ถ้ายังไม่มี ให้ comment out หรือสร้าง garages table ก่อน

### Error: pg_cron extension not available
- ใช้ external cron service แทน
- หรือเรียก `check_maintenance_alerts()` จาก frontend เมื่อโหลดหน้า

---

## 📝 หมายเหตุสำคัญ

1. **Generated Columns** - ไม่ต้อง insert ค่า:
   - `vehicle_usage.distance_km`
   - `vehicle_usage.duration_hours`
   - `fuel_records.total_cost`

2. **UUID vs Bigint**:
   - `tickets.id` = bigint (auto-increment)
   - `vehicle_usage.id` = uuid
   - `vehicles.id` = uuid

3. **Timestamps**:
   - ใช้ `timestamptz` (timezone-aware)
   - Default: `now()`

4. **RLS Policies**:
   - ตรวจสอบว่า user มีสิทธิ์อ่าน/เขียน
   - Admin role สามารถจัดการได้ทั้งหมด

---

## 🚀 Next Steps หลัง Migration

1. สร้าง test user ใน Supabase Auth
2. สร้าง profile สำหรับ test user
3. เพิ่ม test vehicles
4. ทดสอบ RLS policies
5. ทดสอบ views และ functions

